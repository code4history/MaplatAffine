import { Position } from "geojson";

/**
 * 2次元の観測値と予測値から、RMSE  (座標単位)を計算して返す関数
 *
 * @param observedPoints  観測された実座標(既知の正しい座標)   [x, y]
 * @param predictedPoints 変換などで推定した座標              [x, y]
 * @returns RMSE
 */
export function computeRMSE(
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

  return rmse;
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