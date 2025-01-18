import { describe, it, expect } from "vitest";
import { AffineParams } from "@/interface";
import { Position } from "geojson";
import { forwardAffine, inverseAffine } from "../src/transform";
import { computeTransformParams } from '../src/compute';
import proj4 from 'proj4';
import * as proj4List from 'proj4-list';
import { findBestCRS } from "@/find_best";

proj4.defs((proj4List as any)["EPSG:2448"][0], (proj4List as any)["EPSG:2448"][1]);
proj4.defs((proj4List as any)["EPSG:4326"]);

const paramsSet:{[key: string]: [number, number, AffineParams]} = {
  //"GSI generated sample": [
  //  536, 438, [305.7481131407036, 0, 15279456.206093594, 0, -305.7481131407036, 4451081.031102385]
  //],
  "Higashinari-ku map": [
    6870, -4425, [0.55234656386111614, 0, -43442.83179692397970939, 0, -0.54277234478226033, -145725.7218511603132356]
  ]
};

const points = [
  [-42230.10981637174700154, -147210.28902011708123609, 2189.0021552886300924, 2742.40197565315975226],
  [-42934.01468391591333784,-147871.84044746911968105,926.67960008358113555,3972.68095830300171656],
  [-40605.69369746746815508,-147648.0546213670168072,5138.44064160916968831,3515.83560469340454802],
  [-40500.45328745093866019,-146454.92905866517685354,5328.22044077345253754,1345.41055782898502002],
  [-42456.95575178130820859,-146600.85088255623122677,1779.65277777777828305,1624.82905982905981546],
  [-40066.87870549686340382,-146824.83907915951567702,6121.6506410256424715,2015.25106837606927002],
  [-41481.24676890704722609,-147831.8542326072929427,3556.02029914530157839,3880.01602564102586257],
  [-41508.63966815885214601,-146900.868350552249467,3503.40277777778101154,2163.63247863247852365],
  [-42709.36175203017774038,-147044.07544630076154135,1325.03739316239671098,2450.92414529914549348]
];

points.forEach(point => {
  const [mapX, mapY, imageX, imageY] = point;
  const mapPoint: Position = [mapX, mapY];
  const imagePoint: Position = [imageX, imageY];
  const lnglatPoints: Position = proj4("EPSG:2448", "EPSG:4326", mapPoint);
  //console.log(`[${imagePoint[0]}, ${imagePoint[1]}] => [${mapPoint[0]}, ${mapPoint[1]}] => [${lnglatPoints[0]}, ${lnglatPoints[1]}]`);
});

describe("Bidirectional affine transform ", () => {
  for (const key in paramsSet) {
    const [W, H, params] = paramsSet[key];
    
    describe(key, () => {
      const imagePoints: Position[] = [];
      const mapPoints: Position[] = [];
      const latlngPoints: Position[] = [];

      it("forward and inverse", () => {  
        for (let i = 0; i < 10; i++) {
          const x = Math.round(i * W / 10);
          for (let j = 0; j < 10; j++) {
            const y = Math.round(j * H / 10);
  
            const imagePoint: Position = [x, y];
            imagePoints.push(imagePoint);
            const mapPoint = forwardAffine(params, imagePoint);
            mapPoints.push(mapPoint);

            const imagePoint2 = inverseAffine(params, mapPoint);
          
            expect(imagePoint2[0]).toBeCloseTo(imagePoint[0]);
            expect(imagePoint2[1]).toBeCloseTo(imagePoint[1]);

            const latlng = proj4("EPSG:2448", "EPSG:4326", mapPoint);
            latlngPoints.push(latlng);
            //console.log(`[${x}, ${y}] => [${mapPoint[0]}, ${mapPoint[1]}] => [${latlng[0]}, ${latlng[1]}]`);
          }
        }
      });

      /*it("computeAffineParams (Affine)", () => {
        const computedParams = computeTransformParams(imagePoints, mapPoints);
        for (let i = 0; i < 6; i++) {
          expect(computedParams[i]).toBeCloseTo(params[i]);
        }
      });

      if (Math.abs(params[0]) == Math.abs(params[4])) {
        it("computeAffineParams (Similar)", () => {
          const computedParams = computeTransformParams(imagePoints, mapPoints, 'similar');
          for (let i = 0; i < 6; i++) {
            expect(computedParams[i]).toBeCloseTo(params[i]);
          }
        });

        if (params[1] == 0 && params[3] == 0) {
          it("computeAffineParams (No Shear)", () => {
            const computedParams = computeTransformParams(imagePoints, mapPoints, 'noshear');
            for (let i = 0; i < 6; i++) {
              expect(computedParams[i]).toBeCloseTo(params[i]);
            }
          });
        }
      }*/
    });
  }
});
