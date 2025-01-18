import { describe, it, expect } from "vitest";
import proj4 from 'proj4';
import * as proj4List from 'proj4-list';
import { findBestCRS } from "@/find_best";

const actualExample = [
  [[2189.00215528863, 2742.4019756531598], [135.53918377940292,34.67214118322921]],
  [[926.6796000835811, 3972.6809583030017], [135.53153654795568,34.66614807037579]],
  [[5138.44064160917, 3515.8356046934045], [135.55692999175437,34.66826046037723]],
  [[5328.2204407734525, 1345.410557828985], [135.55802116210236,34.67902059765412]],
  [[1779.6527777777783, 1624.8290598290598], [135.53667790668877, 34.677625839326254]],
  [[6121.6506410256425, 2015.2510683760693], [135.5627701377509, 34.67570294055431]],
  [[3556.0202991453016, 3880.016025641026], [135.54738564570337, 34.66656842194967]],
  [[3503.402777777781, 2163.6324786324785], [135.54704107841619, 34.674960096113246]],
  [[1325.0373931623967, 2450.9241452991455], [135.53394592723382, 34.67361970566252]]
];

describe("Actual assume", () => {
  it("Higashinari UTM", () => {
    const imagePoints = actualExample.map(data => data[0]);
    const lnglatPoints = actualExample.map(data => data[1]);
    const candidates = ["EPSG:2448", "EPSG:3099", "EPSG:3857", "EPSG:30166"];
    candidates.forEach(crs => {
      if (!proj4.defs(crs)) {
        const [code, def] = (proj4List as any)[crs];
        proj4.defs(code, def);
      }
    });
    const assumed = findBestCRS(lnglatPoints, imagePoints, candidates, 'affine', 'auto');

    expect(assumed.crs).toBe("EPSG:3099");
  });
});
