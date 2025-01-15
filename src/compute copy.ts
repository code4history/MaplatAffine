import { Position } from 'geojson';
import { AffineParams } from './interface';
import { create, all, Matrix } from 'mathjs';

// mathjsのインスタンスを作成（全機能を読み込む簡易例）
const math = create(all, {});

/**
 * 複数の対応点(画像座標[x,y])と地図座標[X,Y]を使い、
 * アフィン変換パラメータ(A,B,C,D,E,F)を最小二乗法で推定する。
 * 
 * アフィン変換式:
 *   X = A*x + B*y + C
 *   Y = D*x + E*y + F
 * 
 * @param imagePoints 画像座標[x, y]の配列
 * @param mapPoints   地図座標[X, Y]の配列 (imagePointsと同じ長さ)
 * @param returnAsArray? trueの場合、アフィンパラメータを配列で返す
 * @returns アフィンパラメータ [A, B, C, D, E, F]
 */
export default function computeAffineParams(
  imagePoints: Position[],
  mapPoints: Position[]
): AffineParams {
  const n = imagePoints.length;
  if (n < 3) {
    throw new Error("アフィン変換には最低3点以上の対応点が必要です。");
  }
  if (mapPoints.length !== n) {
    throw new Error("imagePointsとmapPointsの数が一致しません。");
  }

  // 2n x 6 の行列 M、2n x 1 のベクトル V を用意
  // （X成分・Y成分それぞれで n点分）
  const M: number[][] = [];
  const V: number[][] = [];

  for (let i = 0; i < n; i++) {
    const [ x, y ] = imagePoints[i]; 
    const [ X, Y ] = mapPoints[i];

    // X_i = A*x + B*y + C
    M.push([x, y, 1, 0, 0, 0]); // この行は A, B, C に対応
    V.push([X]);                // 対応する出力は X

    // Y_i = D*x + E*y + F
    M.push([0, 0, 0, x, y, 1]); // この行は D, E, F に対応
    V.push([Y]);                // 対応する出力は Y
  }

  // mathjsのMatrixに変換
  const MMat = math.matrix(M);  // (2n x 6)
  const VMat = math.matrix(V);  // (2n x 1)

  // 最小二乗解 p = (M^T M)^(-1) * M^T * V
  // 1) Mt = M^T
  const Mt = math.transpose(MMat) as Matrix;    // (6 x 2n)

  // 2) MtM = M^T * M  (6 x 6)
  const MtM = math.multiply(Mt, MMat) as Matrix;

  // 3) (MtM)^-1
  //    ※ MtMが非正則(行列式ゼロ)にならない程度に十分な点数が必要
  const invMtM = math.inv(MtM) as Matrix;

  // 4) MtV = M^T * V (6 x 1)
  const MtV = math.multiply(Mt, VMat) as Matrix;

  // 5) p = inv(MtM) * MtV => (6 x 1)
  const p = math.multiply(invMtM, MtV) as Matrix;

  // p[0]=A, p[1]=B, p[2]=C, p[3]=D, p[4]=E, p[5]=F
  const A = p.get([0, 0]);
  const B = p.get([1, 0]);
  const C = p.get([2, 0]);
  const D = p.get([3, 0]);
  const E = p.get([4, 0]);
  const F = p.get([5, 0]);

  return [A, B, C, D, E, F];
}

/*/ ------------------ テスト用に呼び出してみる例 ----------------------
(() => {
  // 仮の対応点
  const imagePoints: Point2D[] = [
    { x: 100, y: 200 },
    { x: 300, y: 200 },
    { x: 100, y: 400 },
    // 必要に応じて追加
  ];
  const mapPoints: MapPoint2D[] = [
    { X: 5000,  Y: 10000 },
    { X: 5200,  Y: 10000 },
    { X: 5000,  Y: 10200 },
    // 画像の点と対応する地図上の座標
  ];

  try {
    const result = computeAffineParams(imagePoints, mapPoints);
    console.log("推定アフィンパラメータ:", result);
    // 例： { A: ..., B: ..., C: ..., D: ..., E: ..., F: ... }

    // もしワールドファイル形式の順序で出力したい場合:
    //  ArcGIS系: [A, D, B, E, C, F] の順番で出力するケースが多い
    // ただしソフトによって解釈順が異なる場合があるので注意
  } catch (err) {
    console.error("エラー:", err);
  }
})();*/
