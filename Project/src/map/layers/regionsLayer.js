// src/map/layers/regionsLayer.js
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { createRegionStyle } from '../styles/regionStyle';

/**
 * ADM1 regions layer. The layer and its source are created once;
 * features arrive later through setFeatures().
 *
 * It has no style state: every region is drawn the same way, always. The
 * hovered region is shown by another layer, which raises its outline as a
 * wall (regionWallLayer); this one says which region is under the mouse
 * (pickAt) and hands out its geometry (getGeometry).
 *
 * @param {object} regionTokens mapTokens.region
 */
export function createRegionsLayer(regionTokens) {
  const source = new VectorSource();
  const layer = new VectorLayer({
    source,
    style: createRegionStyle(regionTokens),
  });

  return {
    layer,

    /** @param {import('ol/Feature').default[]} features in the view projection */
    setFeatures(features) {
      source.clear(true);
      source.addFeatures(features);
    },

    /**
     * The region whose area contains a map coordinate, or null. The whole
     * area counts, not only the outline: regions have no fill, but the mouse
     * is "over Kakheti" anywhere inside it.
     *
     * @param {import('ol/coordinate').Coordinate} coordinate in the view projection
     * @returns {string|null} region id
     */
    pickAt(coordinate) {
      const [feature] = source.getFeaturesAtCoordinate(coordinate);
      return feature?.getId() ?? null;
    },

    /**
     * @param {string} id region id (Feature.id)
     * @returns {import('ol/geom/Geometry').default|null} in the view projection
     */
    getGeometry(id) {
      return source.getFeatureById(id)?.getGeometry() ?? null;
    },
  };
}
