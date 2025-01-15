import { Position } from "geojson";

/**
 * 観測値(obs)と予測値(pred)を受け取り、
 * RMS誤差(RMSE)を計算して返す関数
 * 
 * @param observedPoints 観測された実座標(既知の正しい座標)
 * @param predictedPoints 変換などで推定した座標
 * @returns RMS誤差(単位は元の座標系と同じ)
 */
export default function computeRMSE(
  observedPoints: Position[],
  predictedPoints: Position[]
): number {
  const n = observedPoints.length;

  if (n === 0 || n !== predictedPoints.length) {
    throw new Error("配列の要素数が不足または不一致です。");
  }

  let sumOfSquaredDifferences = 0;

  for (let i = 0; i < n; i++) {
    const dx = observedPoints[i][0] - predictedPoints[i][0];
    const dy = observedPoints[i][1] - predictedPoints[i][1];
    sumOfSquaredDifferences += dx * dx + dy * dy;
  }

  // 2次元なので X, Y の差異の二乗和をとってから平均し、平方根をとる
  const mse = sumOfSquaredDifferences / n;  // Mean Squared Error
  const rmse = Math.sqrt(mse);             // Root Mean Square Error

  return rmse;
}

/*/ ------------------ 使い方のサンプル ----------------------

// 観測値(正解)の座標 - 例
const observed: Point2D[] = [
  { x: 100.0, y: 200.0 },
  { x: 300.1, y: 200.2 },
  { x: 99.9,  y: 399.8 },
];

// 変換後の予測値(仮)
const predicted: Point2D[] = [
  { x: 100.2, y: 199.7 },
  { x: 300.0, y: 200.5 },
  { x: 100.1, y: 400.0 },
];

const rmseValue = computeRMSE(observed, predicted);
console.log("RMS誤差:", rmseValue);*/