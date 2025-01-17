import { Position } from "geojson";

/**
 * 2次元の観測値と予測値から、
 *   1) RMSE  (座標単位)
 *   2) 2次元の標準偏差(σ) (観測値のみから算出)
 *   3) ratio = RMSE / σ  (無次元)
 *
 * を計算して返す関数
 *
 * @param observedPoints  観測された実座標(既知の正しい座標)   [x, y]
 * @param predictedPoints 変換などで推定した座標                 [x, y]
 * @returns ratio = RMSE / σ
 */
export function computeRMSEOverStdRatio(
  observedPoints: Position[],
  predictedPoints: Position[]
): number {
  const n = observedPoints.length;
  if (n === 0 || n !== predictedPoints.length) {
    throw new Error("配列の要素数が不足または不一致です。");
  }

  // ---------------------------
  // 1) RMSEの計算
  // ---------------------------
  let sumSqDiff = 0; // Σ{ (dx^2 + dy^2) } の総和
  for (let i = 0; i < n; i++) {
    const dx = observedPoints[i][0] - predictedPoints[i][0];
    const dy = observedPoints[i][1] - predictedPoints[i][1];
    sumSqDiff += dx*dx + dy*dy;
  }
  const mse = sumSqDiff / n;
  const rmse = Math.sqrt(mse);

  // ---------------------------
  // 2) 観測値の2次元標準偏差(σ)を計算
  //    - 重心( meanX, meanY ) を求める
  //    - 各点との距離^2 の平均の平方根
  //      (サンプル分散で割るなら n-1 にするなど調整可能)
  // ---------------------------
  let meanX = 0, meanY = 0;
  for (let i = 0; i < n; i++) {
    meanX += observedPoints[i][0];
    meanY += observedPoints[i][1];
  }
  meanX /= n;
  meanY /= n;

  let sumSqDist = 0; // Σ{ ( (x_i - meanX)^2 + (y_i - meanY)^2 ) }
  for (let i = 0; i < n; i++) {
    const dx = observedPoints[i][0] - meanX;
    const dy = observedPoints[i][1] - meanY;
    sumSqDist += dx*dx + dy*dy;
  }

  // 標本分散にしたいなら "n-1" で割ることが多い
  // 普通の母分散にしたいなら "n"
  // ここでは母分散想定として n で割ります
  const var2d = sumSqDist / n;
  const std2d = Math.sqrt(var2d);

  // ---------------------------
  // 3) ratio = RMSE / std2d
  // ---------------------------
  let ratio = 0;
  if (std2d > 1e-15) {
    ratio = rmse / std2d;
  } else {
    // もし観測値が全て同一点で std2d=0 になったら、比較不能なので0などを返す
    ratio = 0;
  }

  // 結果をまとめて返す
  //return {
  //  rmse,   // 座標系の単位（m,度など）
  //  std2d,  // 観測値の2次元バラつき (同じ単位)
  //  ratio   // 次元なし (RMSE/std)
  //};

  return ratio;
}

/*/ ------------------ 使い方サンプル ------------------
(() => {
  // 観測データ例
  const observed: Position[] = [
    [100, 200],
    [102, 198],
    [98,  203],
  ];
  // 予測(推定)データ例
  const predicted: Position[] = [
    [101, 201],
    [100, 200],
    [100, 200],
  ];

  const result = computeRMSEOverStd(observed, predicted);
  console.log("RMSE:", result.rmse.toFixed(4));
  console.log("標準偏差(2D):", result.std2d.toFixed(4));
  console.log("ratio = RMSE / std2d:", result.ratio.toFixed(4));
})();*/