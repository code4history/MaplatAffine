import { describe, it, expect } from "vitest";
import { AffineParams } from "@/interface";
import { Position } from "geojson";
import { forwardAffine, inverseAffine } from "../src/transform";
import { computeTransformParams } from '../src/compute';

const paramsSet:{[key: string]: [number, number, AffineParams]} = {
  "GSI generated sample": [
    536, 438, [305.7481131407036, 0, 15279456.206093594, 0, -305.7481131407036, 4451081.031102385]
  ]
};

describe("Bidirectional affine transform ", () => {
  for (const key in paramsSet) {
    const [W, H, params] = paramsSet[key];
    
    describe(key, () => {
      const imagePoints: Position[] = [];
      const mapPoints: Position[] = [];

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
          }
        }
      });

      it("computeAffineParams (Affine)", () => {
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
      }
    });
  }
})
