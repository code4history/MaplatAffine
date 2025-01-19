import { Position } from "geojson";
import { AffineParams } from "./interface";

/**
 * アフィン変換(順方向)
 * 画像座標 (x, y) → 地図座標 (X, Y)
 * 
 * @param params アフィンパラメータ [ A, B, C, D, E, F ]
 * @param imagePoints 入力座標 [ x, y ]
 * @returns [ X, Y ] 変換後の座標
 */
export function forwardAffine(
  params: AffineParams,
  imagePoints: Position
): Position {
  const [ A, B, C, D, E, F ] = params;
  const [ x, y ] = imagePoints;

  const X = A * x + B * y + C;
  const Y = D * x + E * y + F;
  return [ X, Y ];
}

/**
 * アフィン変換(逆方向)
 * 地図座標 (X, Y) → 画像座標 (x, y)
 * 
 * @param params アフィンパラメータ [ A, B, C, D, E, F ]
 * @param mapPoints 入力座標 [ X, Y ]
 * @returns [ x, y ] 逆変換後の座標
 */
export function inverseAffine(
  params: AffineParams,
  mapPoints: Position
): Position {
  const [ A, B, C, D, E, F ] = params;
  const [ X, Y ] = mapPoints;
  
  // 行列の determinant
  const det = A * E - B * D;
  if (Math.abs(det) < 1e-15) {
    throw new Error("逆行列が存在しない (det ~ 0) : このアフィン変換は非正則です。");
  }
  
  const Xc = X - C;
  const Yf = Y - F;

  // x = ( E*(X - C) - B*(Y - F) ) / det
  // y = ( -D*(X - C) + A*(Y - F) ) / det
  const x = (E * Xc - B * Yf) / det;
  const y = (-D * Xc + A * Yf) / det;

  return [ x, y ];
}