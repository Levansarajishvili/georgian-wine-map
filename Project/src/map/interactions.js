// src/map/interactions.js

/**
 * Extra reach around the pointer, in CSS px. A finger is less precise than a
 * mouse; markers have their own 24×24 px target on top of this (zonesLayer.pickAt).
 */
const TOLERANCE_PX = { mouse: 2, coarse: 8 };

function getTolerance(event) {
  return event.originalEvent?.pointerType === 'mouse' ? TOLERANCE_PX.mouse : TOLERANCE_PX.coarse;
}

/**
 * Pointer interactions of the zones layer.
 *
 * - singleclick → the zone under the pointer, or null on empty map → onZoneClick.
 * - hover is handled here and never reaches React: it only changes the layer's
 *   style state and the cursor. Mouse only: touch has no hover.
 *
 * Stage 8: the same highlight (outline + label that is always visible) also
 * marks the zone a keyboard user has reached, in the region list or on the
 * map. That zone comes from outside through `getHighlightedId` and wins over
 * the mouse: it was chosen on purpose, the mouse may just be resting there.
 * The cursor still follows the mouse only.
 *
 * @param {import('ol/Map').default} map
 * @param {ReturnType<typeof import('./layers/zonesLayer').createZonesLayer>} zones
 * @param {object} handlers
 * @param {(id: string|null) => void} handlers.onZoneClick
 * @param {() => string|null} [handlers.getHighlightedId] zone to highlight
 *   whatever the mouse does; read on every refresh
 * @returns {{ detach: () => void, refreshHover: () => void }} call
 *   refreshHover() after the value behind getHighlightedId has changed
 */
export function attachZoneInteractions(map, zones, { onZoneClick, getHighlightedId = () => null }) {
  const viewport = map.getViewport();
  /** Last mouse position in CSS px, or null while the mouse is outside the map. */
  let mousePixel = null;
  /** Zone under the mouse, or null. */
  let mouseZoneId = null;

  const pick = (coordinate, tolerancePx) => {
    const resolution = map.getView().getResolution();
    if (!coordinate || resolution === undefined) return null;
    return zones.pickAt(coordinate, resolution, tolerancePx)[0] ?? null;
  };

  const applyHover = () => {
    zones.setHovered(getHighlightedId() ?? mouseZoneId);
    viewport.style.cursor = mouseZoneId ? 'pointer' : '';
  };

  const updateHover = () => {
    mouseZoneId = mousePixel
      ? pick(map.getCoordinateFromPixel(mousePixel), TOLERANCE_PX.mouse)
      : null;
    applyHover();
  };

  const handleClick = (event) => {
    onZoneClick(pick(event.coordinate, getTolerance(event)));
  };

  const handlePointerMove = (event) => {
    if (event.originalEvent?.pointerType !== 'mouse') return;
    mousePixel = event.pixel;
    // While dragging, the zone under the pointer changes on every frame: wait for moveend.
    if (!event.dragging) updateHover();
  };

  const handlePointerLeave = () => {
    mousePixel = null;
    updateHover();
  };

  map.on('singleclick', handleClick);
  map.on('pointermove', handlePointerMove);
  // Zooming under a resting mouse changes what is below it (and marker ↔ polygon).
  map.on('moveend', updateHover);
  viewport.addEventListener('pointerleave', handlePointerLeave);

  return {
    detach() {
      map.un('singleclick', handleClick);
      map.un('pointermove', handlePointerMove);
      map.un('moveend', updateHover);
      viewport.removeEventListener('pointerleave', handlePointerLeave);
      viewport.style.cursor = '';
    },
    refreshHover: applyHover,
  };
}
