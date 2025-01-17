import { describe, it, expect } from "vitest";
import { AffineParams } from "@/interface";
import { Position } from "geojson";
import { forwardAffine, inverseAffine } from "../src/transform";
import { computeTransformParams } from '../src/compute';
import fs from "node:fs";
import { findBestCRS } from "@/find_best";

type TestData = {
  name:string,
  crs:string,
  crs_candidates:string[],
  wh: Position,
  params: AffineParams,
  gcps: { image:Position, map:Position, lnglat:Position }[]
}

const testData: TestData[] = [];
fs.readdirSync("tests/data").forEach(file => {
  if (file.endsWith(".json")) {
    testData.push(JSON.parse(fs.readFileSync(`tests/data/${file}`, "utf-8")) as TestData);
  }
});

describe("Bidirectional affine transform ", () => {
  testData.forEach((data) => {
    describe(data.name, () => {
      const params = data.params;

      it("forward and inverse", () => {
        data.gcps.forEach(gcp => {
          const imagePoint = gcp.image;
          const mapPoint = gcp.map;
          const mapPoint2 = forwardAffine(params, imagePoint);
          const imagePoint2 = inverseAffine(params, mapPoint);

          expect(imagePoint2[0]).toBeCloseTo(imagePoint[0]);
          expect(imagePoint2[1]).toBeCloseTo(imagePoint[1]);
          expect(mapPoint2[0]).toBeCloseTo(mapPoint[0]);
          expect(mapPoint2[1]).toBeCloseTo(mapPoint[1]);
        }); 
      });

      const imagePoints = data.gcps.map(gcp => gcp.image);
      const mapPoints = data.gcps.map(gcp => gcp.map);
      const lnglatPoints = data.gcps.map(gcp => gcp.lnglat);

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

      it ("Assume CRS", () => {
        const crses = data.crs_candidates;
        crses.push(data.crs);
        const bestCRS = findBestCRS(lnglatPoints, imagePoints, crses);
        expect(bestCRS).toBe(data.crs);
      });

    });
  });
})
