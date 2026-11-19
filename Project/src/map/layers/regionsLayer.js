// src/map/layers/regionsLayer.js
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { createRegionStyle } from '../styles/regionStyle';

/**
 * ADM1 regions layer. The layer and its source are created once;
 * features arrive later through setFeatures().
 *
 * Owns its style state (the hovered region). A change updates the state and
 * calls layer.changed(): features are never recreated.
 *
 * @param {object} regionTokens mapTokens.region
 */
export function createRegionsLayer(regionTokens) {
  const state = {
    /** @type {string|null} */
    hoveredId: null,
  };

  const source = new VectorSource();
  const layer = new VectorLayer({
    source,
    style: createRegionStyle(regionTokens, state),
  });

  return {
    layer,

    /** @param {import('ol/Feature').default[]} features in the view projection */
    setFeatures(features) {
      source.clear(true);
      source.addFeatures(features);
    },

    /**
     * Redraws only when the value really changed.
     * @param {string|null} id region id (Feature.id), or null
     */
    setHovered(id) {
      const next = id ?? null;
      if (state.hoveredId === next) return false;
      state.hoveredId = next;
      layer.changed();
      return true;
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
  };
}
