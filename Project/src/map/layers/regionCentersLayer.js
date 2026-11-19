// src/map/layers/regionCentersLayer.js
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { createRegionCenterStyle } from '../styles/regionCenterStyle';

/**
 * Administrative centres of the regions (Telavi for Kakheti): one location
 * pin per centre, drawn above the zones so a zone fill never covers it.
 *
 * The pins are permanent and the layer has no style state: a pin looks the
 * same whatever happens. A click on a pin opens the popup with the name of
 * the town (regionCenterPopup); pickAt() says which pin was hit.
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

    /**
     * The centre whose pin is under a map coordinate, or null.
     *
     * Like zonesLayer.pickAt, independent of OpenLayers' own hit detection.
     * The target is the box around the pin as drawn (the tip is on the
     * point, the body is above it) plus the tolerance. With the 2px of a
     * mouse it is already larger than 24×24 CSS px (WCAG 2.5.8). Of two pins
     * that overlap, the one whose head is nearer wins.
     *
     * @param {import('ol/coordinate').Coordinate} coordinate in the view projection
     * @param {number} resolution current view resolution
     * @param {number} [tolerancePx] extra reach for imprecise pointers
     * @returns {{ id: string, name: string, coordinate: number[] }|null}
     *   `coordinate` is the centre's own point (the tip of the pin)
     */
    pickAt(coordinate, resolution, tolerancePx = 0) {
      const { height, radius, casingWidth } = regionCenterTokens;
      const reach = casingWidth + tolerancePx;
      let best = null;

      source.forEachFeature((feature) => {
        const point = feature.getGeometry().getCoordinates();
        // CSS px from the tip of the pin; `up` grows towards the head
        // (the view is never rotated).
        const right = (coordinate[0] - point[0]) / resolution;
        const up = (coordinate[1] - point[1]) / resolution;
        if (Math.abs(right) > radius + reach || up > height + reach || up < -reach) return;

        const distance = Math.hypot(right, up - (height - radius));
        if (!best || distance < best.distance) {
          best = { id: feature.getId(), name: feature.get('name'), coordinate: point, distance };
        }
      });

      return best && { id: best.id, name: best.name, coordinate: best.coordinate };
    },
  };
}
