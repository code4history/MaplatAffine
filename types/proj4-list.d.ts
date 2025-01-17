declare module 'proj4-list' {
  /**
   * 各定義の構造
   */
  interface Proj4Definition {
    /**
     * 例: "EPSG:4326", "EPSG:3857"
     */
    code: string;
    /**
     * 例: "+proj=longlat +datum=WGS84 +no_defs" など
     */
    projection: string;
  }

  /**
   * proj4-list は、上記の {code, projection} オブジェクトを配列で返す
   */
  const definitions: Proj4Definition[];

  export = definitions;
}