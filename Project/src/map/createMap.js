// src/map/createMap.js
import Map from 'ol/Map';
import View from 'ol/View';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import { easeOut } from 'ol/easing';
import { isEmpty } from 'ol/extent';
import { createBasemapLayers } from './basemaps';
import { createRegionsLayer } from './layers/regionsLayer';
import { readMapTokens } from './styles/mapTokens';

const PROJECTION = 'EPSG:3857';

// Zoom limits. MIN: the whole country still fits a 320px-wide screen.
// MAX: village level; basemaps with a lower provider limit are upscaled.
const MIN_ZOOM = 5;
const MAX_ZOOM = 15;

// Layer order: basemap → regions → zones (zones are added in stage 5).
const Z_INDEX = { basemap: 0, regions: 10 };

/**
 * Creates the map and returns the map controller: the only way the rest of
 * the app talks to OpenLayers. Knows nothing about React.
 *
 * The view has no centre until fitToExtent() is called for the first time, so
 * nothing is drawn before the regions extent is known.
 *
 * @param {object} options
 * @param {HTMLElement} options.target map container
 * @param {HTMLElement} options.zoomTarget container for the zoom buttons
 * @param {HTMLElement} options.attributionTarget container for the attribution
 * @param {{ zoomIn: string, zoomOut: string }} options.labels
 * @param {string} options.basemapId initially visible basemap
 */
export function createMap({ target, zoomTarget, attributionTarget, labels, basemapId }) {
  const tokens = readMapTokens();

  const basemapLayers = createBasemapLayers(basemapId);
  basemapLayers.forEach((layer) => layer.setZIndex(Z_INDEX.basemap));

  const regions = createRegionsLayer(tokens.region);
  regions.layer.setZIndex(Z_INDEX.regions);

  const zoom = new Zoom({
    target: zoomTarget,
    zoomInLabel: '+',
    zoomOutLabel: '−',
    zoomInTipLabel: labels.zoomIn,
    zoomOutTipLabel: labels.zoomOut,
    // OpenLayers default duration, or none under prefers-reduced-motion.
    ...(tokens.motion.mapDuration === 0 ? { duration: 0 } : {}),
  });
  // The visible label is a symbol, so the accessible name is set explicitly.
  zoom.element.querySelector('.ol-zoom-in').setAttribute('aria-label', labels.zoomIn);
  zoom.element.querySelector('.ol-zoom-out').setAttribute('aria-label', labels.zoomOut);

  const attribution = new Attribution({
    target: attributionTarget,
    collapsible: false,
  });

  const view = new View({
    projection: PROJECTION,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    enableRotation: false,
  });

  const map = new Map({
    target,
    view,
    layers: [...basemapLayers.values(), regions.layer],
    controls: [zoom, attribution],
  });

  return {
    /** @param {{ regions?: import('ol/Feature').default[] }} features */
    setFeatures({ regions: regionFeatures }) {
      if (regionFeatures) regions.setFeatures(regionFeatures);
    },

    /** @param {string} id basemap id from map/basemaps.js */
    setBasemap(id) {
      if (!basemapLayers.has(id)) return;
      basemapLayers.forEach((layer, layerId) => layer.setVisible(layerId === id));
    },

    /**
     * @param {import('ol/extent').Extent} extent in the view projection
     * @param {object} [options]
     * @param {number[]} [options.padding] [top, right, bottom, left] in CSS px
     * @param {boolean} [options.animate]
     */
    fitToExtent(extent, { padding = [0, 0, 0, 0], animate = true } = {}) {
      if (!extent || isEmpty(extent)) return;
      map.updateSize();
      view.fit(extent, {
        size: map.getSize(),
        padding,
        duration: animate ? readMapTokens().motion.mapDuration : 0,
        easing: easeOut,
      });
    },

    destroy() {
      map.setTarget(undefined);
      // Controls live in their own targets; dispose() removes their elements too.
      map.dispose();
    },
  };
}
