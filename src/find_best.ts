import proj4 from 'proj4';
import * as proj4List from 'proj4-list';
import { Position } from "geojson";
import { computeRMSE } from './rmse';
import { forwardAffine } from './transform';
import { computeTransformParams, TransformMode, YAxisMode } from './compute';

/**
 * 画像の座標 (imagePoints) と対応する WGS84の経緯度 (lnglatPoints)、
 * 候補となるCRSの配列 (crses) を与えて、
 * 「RMSE / 観測標準偏差」の比率が\最小のCRSを返す関数。
 */
export function findBestCRS(
  lnglatPoints: Position[],  // WGS84の経緯度
  imagePoints: Position[],   // 画像座標(ピクセル座標など)
  crses: string[],           // 候補となるCRS(EPSGコードやproj4のIDなど)
  mode: TransformMode = 'affine',
  yAxisMode: YAxisMode = 'auto'
): string {
  // 画像座標と経緯度の対応点数が一致していなければエラー
  if (lnglatPoints.length !== imagePoints.length) {
    throw new Error('The number of lnglatPoints and imagePoints must be the same.');
  }

  // 中間結果を保存するオブジェクト
  const mapPoints: { [key: string]: Position[] } = {};        // 各CRSで投影した結果(地図座標)を保持
  const affineParams: { [key: string]: any } = {};            // 各CRSごとのアフィンパラメータ
  const assumedMapPoints: { [key: string]: Position[] } = {}; // アフィンで再投影した座標(予測座標)
  const rmse: { [key: string]: number } = {};                 // 最終的なRMSEの値(あるいは別指標)

  for (const crs of crses) {
    // 1) proj4.defs(crs) が未登録なら、proj4-list経由で定義を追加
    if (!proj4.defs(crs)) {
      const [code, def] = (proj4List as any)[crs] as string[];
      proj4.defs(code, def);
    }

    // 2) lnglatPoints (WGS84) を そのCRS に投影して mapPoints[crs] を得る
    //    proj4('WGS84', crs, [lng, lat]) は [X, Y] (地図座標)を返す
    mapPoints[crs] = lnglatPoints.map(point => proj4(crs).forward(point));

    // 3) 画像座標(imagePoints) と 得られた地図座標(mapPoints[crs]) から
    //    アフィンパラメータを推定
    affineParams[crs] = computeTransformParams(imagePoints, mapPoints[crs], mode, yAxisMode);

    // 4) 画像座標をアフィン変換してみる → 地図座標がどう予測されるか
    assumedMapPoints[crs] = imagePoints.map(point => {
      return forwardAffine(affineParams[crs], point);
    });

    // 5) 実際の地図座標(mapPoints[crs]) と、アフィン変換で求めた地図座標(assumedMapPoints[crs]) の
    //    RMSEを計算して rmse[crs] に格納
    rmse[crs] = computeRMSE(mapPoints[crs], assumedMapPoints[crs]);
  }

  // 6) ratioが最小になるCRSを返す
  return Object.keys(rmse).reduce((a, b) => (rmse[a] < rmse[b] ? a : b));
}
