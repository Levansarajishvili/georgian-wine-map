// src/map/layers/regionsLayer.js
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { createRegionStyle } from '../styles/regionStyle';

/**
 * ADM1 regions layer. The layer and its source are created once;
 * features arrive later through setFeatures().
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
  };
}
