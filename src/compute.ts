import { create, all, Matrix } from "mathjs";
import { Position } from "geojson";
import { AffineParams } from "./interface";

const math = create(all, {});

/**
 * 変換モード:
 *  - 'affine' : 一般アフィン変換 (6パラメータ自由)
 *  - 'similar': 一様スケール + 回転 + 並進 (相似変換)
 *  - 'noshear': 一様スケール + 並進 (回転無し)
 */
export type TransformMode = 'affine' | 'similar' | 'noshear';

/**
 * Y軸モード:
 *  - 'same'     : 画像座標と地図座標でY軸が同方向
 *  - 'opposite' : 画像座標と地図座標でY軸が逆方向(上下反転)
 *  - 'auto'     : 2パターン試して誤差が小さいほうを採用 (デフォルト)
 */
export type YAxisMode = 'same' | 'opposite' | 'auto';

/**
 * 対応点(画像→地図)から変換パラメータを推定する
 * @param imagePoints 画像座標列
 * @param mapPoints   地図座標列 (同数)
 * @param mode        変換モード('affine'|'similar'|'noshear')
 * @param yAxisMode   'same'|'opposite'|'auto' (デフォルト 'auto')
 * @returns アフィンパラメータ(6つ)を返す
 */
export function computeTransformParams(
  imagePoints: Position[],
  mapPoints: Position[],
  mode: TransformMode = 'affine',
  yAxisMode: YAxisMode = 'auto'
): AffineParams {

  const n = imagePoints.length;
  if (n < 2) {
    throw new Error("少なくとも2点以上の対応点が必要です。アフィンなら本来3点以上推奨。");
  }
  if (mapPoints.length !== n) {
    throw new Error("画像座標と地図座標の配列長が不一致です。");
  }

  switch (mode) {
    case 'affine':
      // 一般アフィンは yAxisMode を気にせず「自由に6パラメータ」をフィットすればOK
      return computeAffine6(imagePoints, mapPoints);

    case 'similar':
      // 相似変換(一様スケール + 回転 + 並進)
      return computeSimilarAsAffine(imagePoints, mapPoints, yAxisMode);

    case 'noshear':
      // 回転なし(一様スケール + 並進)
      return computeNoShearAsAffine(imagePoints, mapPoints, yAxisMode);

    default:
      throw new Error(`未知のモードです: ${mode}`);
  }
}

// ---------------------------------------------------------------------
// 1) 一般アフィン変換 (6パラメータ自由)
// ---------------------------------------------------------------------
function computeAffine6(
  imgPts: Position[],
  mapPts: Position[]
): AffineParams {
  const n = imgPts.length;
  if (n < 3) {
    console.warn("アフィン変換には原則3点以上必要ですが、2点だと退化の恐れがあります。");
  }

  // 行列 M (2n x 6), ベクトル V (2n x 1)
  const M: number[][] = [];
  const V: number[][] = [];

  for (let i = 0; i < n; i++) {
    const [ x, y ] = imgPts[i];
    const [ X, Y ] = mapPts[i];

    // X = A*x + B*y + C
    M.push([x, y, 1, 0, 0, 0]);
    V.push([X]);

    // Y = D*x + E*y + F
    M.push([0, 0, 0, x, y, 1]);
    V.push([Y]);
  }

  const MMat = math.matrix(M);   // (2n x 6)
  const VMat = math.matrix(V);   // (2n x 1)

  // p = (M^T M)^(-1) * (M^T V)
  const Mt  = math.transpose(MMat) as Matrix;   
  const MtM = math.multiply(Mt, MMat) as Matrix; 
  const invMtM = math.inv(MtM) as Matrix;        
  const MtV = math.multiply(Mt, VMat) as Matrix; 
  const p = math.multiply(invMtM, MtV) as Matrix; // (6 x 1)

  const A = p.get([0, 0]);
  const B = p.get([1, 0]);
  const C = p.get([2, 0]);
  const D = p.get([3, 0]);
  const E = p.get([4, 0]);
  const F = p.get([5, 0]);

  return [ A, B, C, D, E, F ];
}

// ---------------------------------------------------------------------
// 2) 相似変換(一様スケール + 回転 + 並進) → アフィンパラメータ
//    + yAxisMode に応じて上下反転を考慮(= reflection)
// ---------------------------------------------------------------------

function computeSimilarAsAffine(
  imgPts: Position[],
  mapPts: Position[],
  yAxisMode: YAxisMode
): AffineParams {

  // まず "標準(反転なし)" として計算
  const paramNoFlip = computeSimilarCore(imgPts, mapPts);

  // "反転" したケース(= Y軸逆) を試す: 画像側だけ上下反転するイメージ
  // 具体的には imgPts の y値を -y にして計算 → その結果のアフィン行列は
  //   X = ...
  //   Y = ...
  //  という形になるが、要は "同じ地図座標"に合うようにするので
  //  Y軸が逆だと scaleが負になる・回転が180°加算される などが起きる
  const paramFlip = computeSimilarCore(flipY(imgPts), mapPts);

  // flip版は、実際には
  //   X = A*x + B*(-y) + C   = A*x - B*y + C
  //   Y = D*x + E*(-y) + F   = D*x - E*y + F
  // となる行列として解釈できる

  // paramFlip自体は "画像入力が上下反転されている" 前提での行列(A,B,C,D,E,F)
  // → 実際の(元の)座標系で考えるなら B, E の符号を反転すればOKになる など、少々計算要
  // ただし、「最終的に正しい残差を評価」すれば十分。

  // モードに応じて出し分け
  switch (yAxisMode) {
    case 'same':
      return paramNoFlip;

    case 'opposite':
      // "強制的に反転" → paramFlipを正しく組み直す必要がある
      // ただし下記で "paramFlip" のままでは、計算時に y=-y としてるため
      // そのままだと (x, y) の解釈が違う.
      // → ここでは residual(誤差)を計算して返す or "適切に行列を再合成" する
      return convertFlipParam(paramFlip);

    case 'auto':
    default:
      // 反転なし, あり の両方で "誤差" を計算し、より小さいほうを選択
      const paramA = paramNoFlip;
      const errA = sumOfSquaredResiduals(paramA, imgPts, mapPts);

      const paramB = convertFlipParam(paramFlip);
      const errB = sumOfSquaredResiduals(paramB, imgPts, mapPts);

      return (errA <= errB) ? paramA : paramB;
  }
}

/**
 * 相似変換 (一様スケール+回転+並進) コア計算
 *   反転を考慮しない版 (常に s > 0 になる想定)
 */
function computeSimilarCore(
  imgPts: Position[],
  mapPts: Position[]
): AffineParams {
  const n = imgPts.length;

  // 1) 重心
  let sumX_img = 0, sumY_img = 0;
  let sumX_map = 0, sumY_map = 0;
  for (let i = 0; i < n; i++) {
    sumX_img += imgPts[i][0];
    sumY_img += imgPts[i][1];
    sumX_map += mapPts[i][0];
    sumY_map += mapPts[i][1];
  }
  const cx_img = sumX_img / n;
  const cy_img = sumY_img / n;
  const cx_map = sumX_map / n;
  const cy_map = sumY_map / n;

  // 2) 重心基準へシフト
  const shiftedImg = [];
  const shiftedMap = [];
  for (let i = 0; i < n; i++) {
    shiftedImg.push({
      x: imgPts[i][0] - cx_img,
      y: imgPts[i][1] - cy_img
    });
    shiftedMap.push({
      X: mapPts[i][0] - cx_map,
      Y: mapPts[i][1] - cy_map
    });
  }

  // 3) 回転+スケール = Procrustes解析
  //    bigA = Σ(x'_i * X'_i + y'_i * Y'_i)
  //    bigB = Σ(x'_i * Y'_i - y'_i * X'_i)
  //    bigC = Σ(x'^2 + y'^2)
  let bigA = 0, bigB = 0, bigC = 0;
  for (let i = 0; i < n; i++) {
    const ix = shiftedImg[i].x;
    const iy = shiftedImg[i].y;
    const mX = shiftedMap[i].X;
    const mY = shiftedMap[i].Y;
    bigA += ix*mX + iy*mY;
    bigB += ix*mY - iy*mX;
    bigC += (ix*ix + iy*iy);
  }

  if (Math.abs(bigC) < 1e-15) {
    // 画像側が同一点など → 不可
    throw new Error("相似変換: 画像座標が実質同一点で推定不可");
  }
  const theta = Math.atan2(bigB, bigA);
  const norm = Math.sqrt(bigA*bigA + bigB*bigB);
  const s = norm / bigC;  // >= 0

  // 4) 並進 (tx, ty) = mapCentroid - s*R(θ)(imgCentroid)
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const rx = cosT * cx_img - sinT * cy_img;
  const ry = sinT * cx_img + cosT * cy_img;
  const tx = cx_map - s * rx;
  const ty = cy_map - s * ry;

  // 5) 相似変換 → アフィン行列
  const A =  s*cosT;
  const B = -s*sinT;
  const D =  s*sinT;
  const E =  s*cosT;
  const C =  tx;
  const F =  ty;

  return [ A, B, C, D, E, F ];
}

/**
 * flipY(): 画像の y座標だけ符号反転したコピーを作る
 */
function flipY(imgPts: Position[]): Position[] {
  return imgPts.map(pt => ([ pt[0], -pt[1] ]));
}

/**
 * convertFlipParam():
 *  computeSimilarCore() を "画像yを反転" した状態で得た結果 paramFlip を、
 *  元の(未反転の)画像座標系におけるアフィン行列へ変換する。
 *
 *  イメージ: paramFlip というのは
 *    X = A'(x) + B'( (-y) ) + C'
 *    Y = D'(x) + E'( (-y) ) + F'
 *  の形
 *  これを「元の y」で表すには B,E の符号を反転すればよい 等々、数式で整理可能。
 *
 *  最も簡単には、(paramFlip) を用いて実際に全対応点に対する誤差を
 *  sumOfSquaredResiduals() で計算すれば "適合度" は確認できる。
 *  ただし最終的にユーザが使う行列としては「元の座標→地図座標」として一意に書き直す必要がある。
 *
 *  ここでは B,E の符号を反転して「(x, y) => (X, Y)」の式に直します。
 */
function convertFlipParam(
  paramFlip: AffineParams
): AffineParams {
  // paramFlip は
  //   X = A*x + B*(-y) + C
  //   Y = D*x + E*(-y) + F
  //  (ただし x,y は"反転された"もの)
  // "元の y" についての式へ変形すれば
  //   X = A*x - B*y + C
  //   Y = D*x - E*y + F
  //
  // → これはアフィン行列で言えば
  //   A stays as is
  //   B -> -B
  //   C stays as is
  //   D stays as is
  //   E -> -E
  //   F stays as is

  return [
    paramFlip[0],
    -paramFlip[1],
    paramFlip[2],
    paramFlip[3],
    -paramFlip[4],
    paramFlip[5]
  ];
}


// ---------------------------------------------------------------------
// 3) 回転なし(一様スケール + 並進) → アフィンパラメータ
//    + yAxisMode による上下反転を考慮
// ---------------------------------------------------------------------

function computeNoShearAsAffine(
  imgPts: Position[],
  mapPts: Position[],
  yAxisMode: YAxisMode
): AffineParams {

  // まず "反転なし" でフィット
  const paramA = computeNoShearCore(imgPts, mapPts);

  // "反転あり" でフィット
  //   → 画像の y を -y にして同じ計算
  const paramFlip_ = computeNoShearCore(flipY(imgPts), mapPts);
  //  ただし paramFlip_ は
  //   X = A*x + B*(-y) + C, Y= D*x + E*(-y) + F
  //  B,D=0の想定→ B=0, D=0. E= A. ただし -y が入るから E= -A ? (要検証)
  //  → ともかく convertFlipParam() 的に B-> -B, E-> -E すれば元のに戻せる
  const paramB = convertFlipParam(paramFlip_);

  switch (yAxisMode) {
    case 'same':
      return paramA;

    case 'opposite':
      return paramB;

    case 'auto':
    default:
      // 両方の誤差を比べて、小さい方
      const errA = sumOfSquaredResiduals(paramA, imgPts, mapPts);
      const errB = sumOfSquaredResiduals(paramB, imgPts, mapPts);
      return (errA <= errB) ? paramA : paramB;
  }
}

/**
 * computeNoShearCore():
 *   回転なし(一様スケール+並進)を
 *   X = A*x + C
 *   Y = A*y + F
 * で最小二乗フィットする
 */
function computeNoShearCore(
  imgPts: Position[],
  mapPts: Position[]
): AffineParams {
  // B=D=0, E=A の制約のもとで A, C, F を推定
  // (2n点の連立 → 3未知数 A,C,F)
  const M: number[][] = [];
  const V: number[][] = [];

  for (let i = 0; i < imgPts.length; i++) {
    const [ x, y ] = imgPts[i];
    const [ X, Y ] = mapPts[i];

    // X_i = A*x_i + C
    M.push([x, 1, 0]);
    V.push([X]);

    // Y_i = A*y_i + F
    M.push([y, 0, 1]);
    V.push([Y]);
  }

  const MMat = math.matrix(M);  // (2n x 3)
  const VMat = math.matrix(V);  // (2n x 1)

  const Mt  = math.transpose(MMat) as Matrix;   // (3 x 2n)
  const MtM = math.multiply(Mt, MMat) as Matrix; // (3 x 3)
  const invMtM = math.inv(MtM) as Matrix;
  const MtV = math.multiply(Mt, VMat) as Matrix; // (3 x 1)
  const p = math.multiply(invMtM, MtV) as Matrix; // (3 x 1)

  const A_ = p.get([0, 0]);  // 一様スケーリング
  const C_ = p.get([1, 0]);  // X方向並進
  const F_ = p.get([2, 0]);  // Y方向並進

  // 結果として B=D=0, E=A
  return [ A_, 0, C_, 0, A_, F_ ];
}

// ---------------------------------------------------------------------
// 4) 誤差(残差平方和)を計算する関数
// ---------------------------------------------------------------------
function sumOfSquaredResiduals(
  affine: AffineParams,
  imgPts: Position[],
  mapPts: Position[]
): number {
  // X_pred = A*x + B*y + C
  // Y_pred = D*x + E*y + F
  let sse = 0;
  for (let i = 0; i < imgPts.length; i++) {
    const [ x, y ] = imgPts[i];
    const [ X, Y ] = mapPts[i];
    const Xp = affine[0]*x + affine[1]*y + affine[2];
    const Yp = affine[3]*x + affine[4]*y + affine[5];
    const dx = X - Xp;
    const dy = Y - Yp;
    sse += dx*dx + dy*dy;
  }
  return sse;
}
