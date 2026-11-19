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
 * @param {(coordinate: number[], tolerancePx: number) => boolean} [handlers.isCovered]
 *   true where something drawn above the zones takes the pointer (the pin of
 *   a regional centre). The zone below is then neither hovered nor clicked,
 *   and onZoneClick is not called at all: a click on a pin does not change
 *   the selection. The cursor is still a pointer, because the click does
 *   something.
 * @returns {{ detach: () => void, refreshHover: () => void }} call
 *   refreshHover() after the value behind getHighlightedId has changed
 */
export function attachZoneInteractions(
  map,
  zones,
  { onZoneClick, getHighlightedId = () => null, isCovered = () => false },
) {
  const viewport = map.getViewport();
  /** Last mouse position in CSS px, or null while the mouse is outside the map. */
  let mousePixel = null;
  /** Zone under the mouse, or null. */
  let mouseZoneId = null;
  /** The mouse is on something above the zones (see isCovered). */
  let mouseCovered = false;

  const pick = (coordinate, tolerancePx) => {
    const resolution = map.getView().getResolution();
    if (!coordinate || resolution === undefined) return null;
    return zones.pickAt(coordinate, resolution, tolerancePx)[0] ?? null;
  };

  const applyHover = () => {
    zones.setHovered(getHighlightedId() ?? mouseZoneId);
    viewport.style.cursor = mouseZoneId || mouseCovered ? 'pointer' : '';
  };

  const updateHover = () => {
    const coordinate = mousePixel ? map.getCoordinateFromPixel(mousePixel) : null;
    mouseCovered = coordinate ? isCovered(coordinate, TOLERANCE_PX.mouse) : false;
    mouseZoneId = mouseCovered ? null : pick(coordinate, TOLERANCE_PX.mouse);
    applyHover();
  };

  const handleClick = (event) => {
    const tolerance = getTolerance(event);
    if (isCovered(event.coordinate, tolerance)) return;
    onZoneClick(pick(event.coordinate, tolerance));
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

/**
 * Clicks on the pins of the regional centres.
 *
 * singleclick → the centre whose pin is under the pointer, or null anywhere
 * else → onCenterClick. What that opens or closes is the listener's business
 * (regionCenterPopup). A pin has no hover of its own: the pointer cursor over
 * it comes from attachZoneInteractions, which is given pickAt() as isCovered,
 * so both sides agree on where a pin is.
 *
 * @param {import('ol/Map').default} map
 * @param {ReturnType<typeof import('./layers/regionCentersLayer').createRegionCentersLayer>} centers
 * @param {object} handlers
 * @param {(center: { id: string, name: string, coordinate: number[] }|null) => void} handlers.onCenterClick
 * @returns {{ detach: () => void, pickAt: (coordinate: number[], tolerancePx: number) => object|null }}
 */
export function attachRegionCenterClick(map, centers, { onCenterClick }) {
  const pickAt = (coordinate, tolerancePx) => {
    const resolution = map.getView().getResolution();
    if (!coordinate || resolution === undefined) return null;
    return centers.pickAt(coordinate, resolution, tolerancePx);
  };

  const handleClick = (event) => {
    onCenterClick(pickAt(event.coordinate, getTolerance(event)));
  };

  map.on('singleclick', handleClick);

  return {
    detach() {
      map.un('singleclick', handleClick);
    },
    pickAt,
  };
}

/**
 * Hover of the regions layer: the region under the mouse gets a prominent
 * outline (regionStyle).
 *
 * Like the zone hover it only changes the layer's style state and never
 * reaches React, and it is mouse only. A zone inside the region does not
 * interrupt it: the mouse is still in the region. The cursor is left alone,
 * because a region cannot be clicked on the map.
 *
 * @param {import('ol/Map').default} map
 * @param {ReturnType<typeof import('./layers/regionsLayer').createRegionsLayer>} regions
 * @returns {() => void} detach
 */
export function attachRegionHover(map, regions) {
  const viewport = map.getViewport();
  /** Last mouse position in CSS px, or null while the mouse is outside the map. */
  let mousePixel = null;

  const updateHover = () => {
    const coordinate = mousePixel ? map.getCoordinateFromPixel(mousePixel) : null;
    regions.setHovered(coordinate ? regions.pickAt(coordinate) : null);
  };

  const handlePointerMove = (event) => {
    if (event.originalEvent?.pointerType !== 'mouse') return;
    mousePixel = event.pixel;
    // Same rule as the zones: while dragging, wait for moveend.
    if (!event.dragging) updateHover();
  };

  const handlePointerLeave = () => {
    mousePixel = null;
    updateHover();
  };

  map.on('pointermove', handlePointerMove);
  // Panning or zooming under a resting mouse changes what is below it.
  map.on('moveend', updateHover);
  viewport.addEventListener('pointerleave', handlePointerLeave);

  return () => {
    map.un('pointermove', handlePointerMove);
    map.un('moveend', updateHover);
    viewport.removeEventListener('pointerleave', handlePointerLeave);
    regions.setHovered(null);
  };
}
