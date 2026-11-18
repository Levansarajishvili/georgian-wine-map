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
 * @param {import('ol/Map').default} map
 * @param {ReturnType<typeof import('./layers/zonesLayer').createZonesLayer>} zones
 * @param {{ onZoneClick: (id: string|null) => void }} handlers
 * @returns {() => void} detach
 */
export function attachZoneInteractions(map, zones, { onZoneClick }) {
  const viewport = map.getViewport();
  /** Last mouse position in CSS px, or null while the mouse is outside the map. */
  let mousePixel = null;

  const pick = (coordinate, tolerancePx) => {
    const resolution = map.getView().getResolution();
    if (!coordinate || resolution === undefined) return null;
    return zones.pickAt(coordinate, resolution, tolerancePx)[0] ?? null;
  };

  const setHovered = (id) => {
    if (zones.setHovered(id)) viewport.style.cursor = id ? 'pointer' : '';
  };

  const updateHover = () => {
    setHovered(mousePixel ? pick(map.getCoordinateFromPixel(mousePixel), TOLERANCE_PX.mouse) : null);
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
    setHovered(null);
  };

  map.on('singleclick', handleClick);
  map.on('pointermove', handlePointerMove);
  // Zooming under a resting mouse changes what is below it (and marker ↔ polygon).
  map.on('moveend', updateHover);
  viewport.addEventListener('pointerleave', handlePointerLeave);

  return () => {
    map.un('singleclick', handleClick);
    map.un('pointermove', handlePointerMove);
    map.un('moveend', updateHover);
    viewport.removeEventListener('pointerleave', handlePointerLeave);
    viewport.style.cursor = '';
  };
}
