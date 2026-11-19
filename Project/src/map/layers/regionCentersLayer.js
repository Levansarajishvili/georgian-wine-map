// src/map/layers/regionCentersLayer.js
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { createRegionCenterStyle } from '../styles/regionCenterStyle';

/**
 * Administrative centres of the regions (Telavi for Kakheti): one location
 * pin per centre, drawn above the zones so a zone fill never covers it.
 *
 * The pins are permanent. The layer has no style state and takes no part in
 * hover or clicks: zones are picked by coordinate (zonesLayer.pickAt), so a
 * zone under a pin stays clickable.
 *
 * @param {object} regionCenterTokens mapTokens.regionCenter
 */
export function createRegionCentersLayer(regionCenterTokens) {
  const source = new VectorSource();
  const layer = new VectorLayer({
    source,
    style: createRegionCenterStyle(regionCenterTokens),
    // The same declutter group as the zones layer (both `true`): the pin is an
    // obstacle there, so a zone label moves aside instead of being drawn over it.
    declutter: true,
  });

  return {
    layer,

    /** @param {import('ol/Feature').default[]} features Point features in the view projection */
    setFeatures(features) {
      source.clear(true);
      source.addFeatures(features);
    },
  };
}
