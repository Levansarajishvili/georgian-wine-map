// src/map/createMap.js
import Map from 'ol/Map';
import View from 'ol/View';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import { easeOut } from 'ol/easing';
import { isEmpty } from 'ol/extent';
import { transformExtent } from 'ol/proj';
import { createBasemapLayers } from './basemaps';
import { attachZoneInteractions } from './interactions';
import { createRegionsLayer } from './layers/regionsLayer';
import { createZonesLayer } from './layers/zonesLayer';
import { readMapTokens } from './styles/mapTokens';
import { LABEL_MIN_ZOOM } from './styles/zoneStyles';

const PROJECTION = 'EPSG:3857';
// Attribute files store bbox and labelPoint in EPSG:4326 (02 §1).
const DATA_PROJECTION = 'EPSG:4326';

// Zoom limits. MIN: the whole country still fits a 320px-wide screen.
// MAX: village level; basemaps with a lower provider limit are upscaled.
const MIN_ZOOM = 5;
const MAX_ZOOM = 15;

// Layer order: basemap → regions → zones.
const Z_INDEX = { basemap: 0, regions: 10, zones: 20 };

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
 * @param {() => number[]} [options.getFitPadding] [top, right, bottom, left] in
 *   CSS px: the part of the map covered by its edges and the bottom sheet.
 *   Read on every fit, because the sheet changes it.
 */
export function createMap({
  target,
  zoomTarget,
  attributionTarget,
  labels,
  basemapId,
  getFitPadding = () => [0, 0, 0, 0],
}) {
  const tokens = readMapTokens();

  const basemapLayers = createBasemapLayers(basemapId);
  basemapLayers.forEach((layer) => layer.setZIndex(Z_INDEX.basemap));

  const regions = createRegionsLayer(tokens.region);
  regions.layer.setZIndex(Z_INDEX.regions);

  const view = new View({
    projection: PROJECTION,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    enableRotation: false,
  });

  const zones = createZonesLayer(tokens.zone, {
    labelMaxResolution: view.getResolutionForZoom(LABEL_MIN_ZOOM),
  });
  zones.layer.setZIndex(Z_INDEX.zones);
  zones.setBasemap(basemapId);

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

  const map = new Map({
    target,
    view,
    layers: [...basemapLayers.values(), regions.layer, zones.layer],
    controls: [zoom, attribution],
  });

  /** @type {Set<(id: string|null) => void>} */
  const zoneClickListeners = new Set();
  const detachZoneInteractions = attachZoneInteractions(map, zones, {
    onZoneClick: (id) => zoneClickListeners.forEach((listener) => listener(id)),
  });

  /**
   * @param {import('ol/extent').Extent} extent in the view projection
   * @param {object} [options]
   * @param {number[]} [options.padding] [top, right, bottom, left] in CSS px;
   *   default: getFitPadding()
   * @param {boolean} [options.animate] default true. The duration is the
   *   --motion-duration-map token, read on every call: under
   *   prefers-reduced-motion it is 0 and the view jumps without animation.
   */
  function fitToExtent(extent, { padding = getFitPadding(), animate = true } = {}) {
    if (!extent || isEmpty(extent)) return;
    map.updateSize();
    view.fit(extent, {
      size: map.getSize(),
      padding,
      duration: animate ? readMapTokens().motion.mapDuration : 0,
      easing: easeOut,
    });
  }

  return {
    /**
     * @param {object} features
     * @param {import('ol/Feature').default[]} [features.regions]
     * @param {import('ol/Feature').default[]} [features.zones] from loadZoneGeometry()
     */
    setFeatures({ regions: regionFeatures, zones: zoneFeatures }) {
      if (regionFeatures) regions.setFeatures(regionFeatures);
      if (zoneFeatures) zones.setFeatures(zoneFeatures);
    },

    /** @param {string} id basemap id from map/basemaps.js */
    setBasemap(id) {
      if (!basemapLayers.has(id)) return;
      basemapLayers.forEach((layer, layerId) => layer.setVisible(layerId === id));
      zones.setBasemap(id);
    },

    /**
     * Filter result for the zones layer: zones outside `matchingIds` are dimmed.
     *
     * @param {object} appearance
     * @param {Set<string>|null} [appearance.matchingIds] null: no filter
     * @param {Map<string, string>} [appearance.colorKeyById] zone id → wine style slug
     */
    setZoneAppearance(appearance) {
      zones.setAppearance(appearance);
    },

    /** @param {string|null} id zone id, or null to clear the selection */
    setSelectedZone(id) {
      zones.setSelected(id);
    },

    /**
     * Subscribes to clicks on the map: the listener gets the clicked zone's
     * id, or null when the click hit no zone.
     *
     * @param {(id: string|null) => void} listener
     * @returns {() => void} unsubscribe
     */
    onZoneClick(listener) {
      zoneClickListeners.add(listener);
      return () => zoneClickListeners.delete(listener);
    },

    fitToExtent,

    /**
     * Fits the view to a `bbox` from regions.json or zones.json (02 §3):
     * the DOM side of the app has no OpenLayers, so the reprojection is here.
     *
     * @param {number[]} bbox [minLon, minLat, maxLon, maxLat], EPSG:4326
     * @param {object} [options] same as fitToExtent()
     */
    fitToBBox(bbox, options) {
      if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) return;
      fitToExtent(transformExtent(bbox, DATA_PROJECTION, PROJECTION), options);
    },

    destroy() {
      detachZoneInteractions();
      zoneClickListeners.clear();
      map.setTarget(undefined);
      // Controls live in their own targets; dispose() removes their elements too.
      map.dispose();
    },
  };
}
