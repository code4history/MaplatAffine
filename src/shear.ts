/**
 * shear2Rotation():
 *   相似変換行列が
 *     [ A  B ] = s [ cosθ  -sinθ ]
 *     [ D  E ]       [ sinθ   cosθ ]
 *   であるとして、(A,B,D,E) から (s, θ) を求める
 *   なお (C,F) は平行移動なので関係なし
 *
 * @returns { s, theta }
 */
export function shear2Rotation(
  A: number, B: number, D: number, E: number
): { s: number; theta: number } {
  // s = sqrt(A^2 + D^2)  (== sqrt(E^2 + B^2) )
  // θ = atan2(D, A)
  const s = Math.sqrt(A*A + D*D);
  if (s < 1e-15) {
    return { s: 0, theta: 0 }; // degenerate case
  }
  const theta = Math.atan2(D, A); // 
  return { s, theta };
}

/**
 * rotation2Shear():
 *   (s, θ) からアフィン行列 (A,B,D,E) を作る (相似変換)
 *   A= s*cosθ, B= -s*sinθ
 *   D= s*sinθ, E=  s*cosθ
 */
export function rotation2Shear(
  s: number,
  theta: number
): { A: number; B: number; D: number; E: number } {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return {
    A:  s * cosT,
    B: -s * sinT,
    D:  s * sinT,
    E:  s * cosT
  };
}