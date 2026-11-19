// src/map/createMap.js
import Map from 'ol/Map';
import View from 'ol/View';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import { easeOut } from 'ol/easing';
import { getBottomRight, getTopLeft, isEmpty } from 'ol/extent';
import DragPan from 'ol/interaction/DragPan';
import KeyboardPan from 'ol/interaction/KeyboardPan';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import { transformExtent } from 'ol/proj';
import { createBasemapLayers } from './basemaps';
import { attachRegionHover, attachZoneInteractions } from './interactions';
import { createRegionCentersLayer } from './layers/regionCentersLayer';
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

// Layer order: basemap → regions → zones → regional centres. The pins are on
// top: a zone fill must not cover the mark of a town.
const Z_INDEX = { basemap: 0, regions: 10, zones: 20, regionCenters: 30 };

// Only listened to; what it means is decided by tokens.css (see below).
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * prefers-reduced-motion, as tokens.css states it: its media block sets
 * --motion-duration-map to 0. One source for CSS and for the map.
 */
const isMotionReduced = () => readMapTokens().motion.mapDuration === 0;

/**
 * OpenLayers' own interactions, with or without their animations.
 *
 * Reduced motion removes every movement the user did not make directly:
 *   zoom steps (double click, wheel, keyboard, shift-drag, end of a pinch)
 *     happen at once (zoomDuration 0);
 *   a drag stops with the pointer: no kinetic glide after release;
 *   arrow keys move the map in steps, without the slide between them.
 * Dragging and pinching themselves stay: the map follows the finger.
 *
 * Rotation interactions are left out in both cases: the view has rotation
 * switched off, so they did nothing.
 */
function createInteractions(reduced) {
  const interactions = defaultInteractions({
    altShiftDragRotate: false,
    pinchRotate: false,
    // undefined: every interaction keeps its OpenLayers default duration.
    zoomDuration: reduced ? 0 : undefined,
  }).getArray();
  if (!reduced) return interactions;

  // Replaced in place: OpenLayers gives events to interactions in order.
  return interactions.map((interaction) => {
    if (interaction instanceof DragPan) return new DragPan();
    if (interaction instanceof KeyboardPan) return new KeyboardPan({ duration: 0 });
    return interaction;
  });
}

/**
 * Creates the map and returns the map controller: the only way the rest of
 * the app talks to OpenLayers. Knows nothing about React.
 *
 * The view has no centre until fitToExtent() is called for the first time, so
 * nothing is drawn before the regions extent is known.
 *
 * Keyboard (stage 8): OpenLayers listens for keys on `target`. When the
 * target is focusable (MapView gives it tabindex), arrow keys pan and + / −
 * zoom while it has the focus; nothing else on the page is affected.
 *
 * Motion (stage 8): every animation the map can run is switched by
 * prefers-reduced-motion: fits, zoom buttons, the interactions above, the
 * elastic zoom limits and the fade-in of tiles. A change of the setting while
 * the page is open is applied at once, except the tile fade-in, which belongs
 * to the tile sources and follows the setting the page was loaded with.
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
  let reducedMotion = tokens.motion.mapDuration === 0;

  const basemapLayers = createBasemapLayers(basemapId, { fadeIn: !reducedMotion });
  basemapLayers.forEach((layer) => layer.setZIndex(Z_INDEX.basemap));

  const regions = createRegionsLayer(tokens.region);
  regions.layer.setZIndex(Z_INDEX.regions);

  /**
   * @param {{ center?: number[], resolution?: number }} [state] carried over
   *   when the view is replaced
   */
  const createView = (state) =>
    new View({
      projection: PROJECTION,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      enableRotation: false,
      // true (the OpenLayers default): zooming past a limit gives way a
      // little and springs back. That spring is an animation.
      smoothResolutionConstraint: !reducedMotion,
      ...state,
    });

  const view = createView();

  const zones = createZonesLayer(tokens.zone, {
    labelMaxResolution: view.getResolutionForZoom(LABEL_MIN_ZOOM),
  });
  zones.layer.setZIndex(Z_INDEX.zones);
  zones.setBasemap(basemapId);

  const regionCenters = createRegionCentersLayer(tokens.regionCenter);
  regionCenters.layer.setZIndex(Z_INDEX.regionCenters);

  const createZoomControl = () => {
    const control = new Zoom({
      target: zoomTarget,
      zoomInLabel: '+',
      zoomOutLabel: '−',
      zoomInTipLabel: labels.zoomIn,
      zoomOutTipLabel: labels.zoomOut,
      // OpenLayers default duration, or none under prefers-reduced-motion.
      ...(reducedMotion ? { duration: 0 } : {}),
    });
    // The visible label is a symbol, so the accessible name is set explicitly.
    control.element.querySelector('.ol-zoom-in').setAttribute('aria-label', labels.zoomIn);
    control.element.querySelector('.ol-zoom-out').setAttribute('aria-label', labels.zoomOut);
    return control;
  };

  let zoom = createZoomControl();

  const attribution = new Attribution({
    target: attributionTarget,
    collapsible: false,
  });

  const map = new Map({
    target,
    view,
    layers: [...basemapLayers.values(), regions.layer, zones.layer, regionCenters.layer],
    controls: [zoom, attribution],
    interactions: createInteractions(reducedMotion),
  });

  /** @type {Set<(id: string|null) => void>} */
  const zoneClickListeners = new Set();
  /** Zone highlighted from outside the map (keyboard), or null. */
  let highlightedId = null;
  const zoneInteractions = attachZoneInteractions(map, zones, {
    onZoneClick: (id) => zoneClickListeners.forEach((listener) => listener(id)),
    getHighlightedId: () => highlightedId,
  });
  const detachRegionHover = attachRegionHover(map, regions);

  // The setting changed while the page is open (or DevTools emulates it):
  // rebuild what was created with the old value. The view keeps its place.
  const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  const handleMotionChange = () => {
    const reduced = isMotionReduced();
    if (reduced === reducedMotion) return;
    reducedMotion = reduced;

    const interactions = map.getInteractions();
    interactions.clear();
    createInteractions(reducedMotion).forEach((interaction) => interactions.push(interaction));

    map.removeControl(zoom);
    zoom = createZoomControl();
    map.addControl(zoom);

    const previous = map.getView();
    previous.cancelAnimations();
    map.setView(
      createView({ center: previous.getCenter(), resolution: previous.getResolution() }),
    );
  };
  motionQuery.addEventListener('change', handleMotionChange);

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
    // map.getView(), not `view`: the view is replaced when the motion setting changes.
    map.getView().fit(extent, {
      size: map.getSize(),
      padding,
      duration: animate ? readMapTokens().motion.mapDuration : 0,
      easing: easeOut,
    });
  }

  /** bbox from the data files (EPSG:4326) → extent of the view, or null if malformed. */
  function toViewExtent(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) return null;
    return transformExtent(bbox, DATA_PROJECTION, PROJECTION);
  }

  /** Whether the whole extent is on screen, inside the fit padding. */
  function isInView(extent) {
    map.updateSize();
    const size = map.getSize();
    if (!size || map.getView().getCenter() === undefined) return false;
    const topLeft = map.getPixelFromCoordinate(getTopLeft(extent));
    const bottomRight = map.getPixelFromCoordinate(getBottomRight(extent));
    if (!topLeft || !bottomRight) return false;
    const [top, right, bottom, left] = getFitPadding();
    return (
      topLeft[0] >= left &&
      topLeft[1] >= top &&
      bottomRight[0] <= size[0] - right &&
      bottomRight[1] <= size[1] - bottom
    );
  }

  return {
    /**
     * @param {object} features
     * @param {import('ol/Feature').default[]} [features.regions]
     * @param {import('ol/Feature').default[]} [features.zones] from loadZoneGeometry()
     * @param {import('ol/Feature').default[]} [features.regionCenters] from
     *   createRegionCenterFeatures(): the pins on the regional centres
     */
    setFeatures({ regions: regionFeatures, zones: zoneFeatures, regionCenters: centerFeatures }) {
      if (regionFeatures) regions.setFeatures(regionFeatures);
      if (zoneFeatures) zones.setFeatures(zoneFeatures);
      if (centerFeatures) regionCenters.setFeatures(centerFeatures);
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
     * Marks a zone the way a mouse hover does (thicker outline, name always
     * shown), from outside the map: the zone a keyboard user has reached in
     * the region list or with the map's own keys. Does not move the map.
     *
     * @param {string|null} id zone id, or null to remove the mark
     */
    setHighlightedZone(id) {
      highlightedId = id ?? null;
      zoneInteractions.refreshHover();
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
      const extent = toViewExtent(bbox);
      if (extent) fitToExtent(extent, options);
    },

    /**
     * Brings a `bbox` on screen only if it is not fully visible already:
     * walking the zones with the keyboard should not re-zoom a map on which
     * the next zone can be seen. Otherwise the same as fitToBBox().
     *
     * @param {number[]} bbox [minLon, minLat, maxLon, maxLat], EPSG:4326
     * @returns {boolean} true when the map moved
     */
    revealBBox(bbox) {
      const extent = toViewExtent(bbox);
      if (!extent || isInView(extent)) return false;
      fitToExtent(extent);
      return true;
    },

    destroy() {
      motionQuery.removeEventListener('change', handleMotionChange);
      zoneInteractions.detach();
      detachRegionHover();
      zoneClickListeners.clear();
      map.setTarget(undefined);
      // Controls live in their own targets; dispose() removes their elements too.
      map.dispose();
    },
  };
}
