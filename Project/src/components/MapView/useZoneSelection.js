// src/components/MapView/useZoneSelection.js
import { useCallback, useEffect, useState } from 'react';

/**
 * Selected zone: the bridge between a click on the map and the selection the
 * map draws.
 *
 *   map click   → controller.onZoneClick → selectedId
 *   selectedId  → controller.setSelectedZone → the zones layer restyles the zone
 *
 * One zone is one feature (a MultiPolygon), so selecting it by id marks every
 * part of it at once. Which zone a click means where zones overlap is decided
 * in the map (zonesLayer.pickAt): the smallest zone under the pointer.
 *
 * Rules:
 *   - a click on a zone selects it; a click on the selected zone keeps it selected;
 *   - a click on empty map clears the selection;
 *   - select(id) accepts an id whose geometry has not loaded yet: the layer
 *     keeps the id and marks the zone as soon as its feature arrives.
 *
 * The selection lives in local state for now. When state/urlState.js exists
 * (01 §5, `zone=` in the URL), only the useState line below is replaced; the
 * returned interface and both effects stay as they are.
 *
 * Call this hook AFTER the effect that creates the map: effects run in the
 * order they are declared, and these two need controllerRef.current. Under
 * StrictMode both run again for the second map instance, so the selection is
 * re-applied to it.
 *
 * @param {{ current: ReturnType<typeof import('../../map/createMap').createMap>|null }} controllerRef
 * @returns {{ selectedId: string|null, select: (id: string|null) => void, clear: () => void }}
 */
export function useZoneSelection(controllerRef) {
  const [selectedId, setSelectedId] = useState(null);

  // Map → state.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return undefined;
    return controller.onZoneClick((id) => setSelectedId(id));
  }, [controllerRef]);

  // State → map.
  useEffect(() => {
    controllerRef.current?.setSelectedZone(selectedId);
  }, [controllerRef, selectedId]);

  const select = useCallback((id) => setSelectedId(id ?? null), []);
  const clear = useCallback(() => setSelectedId(null), []);

  return { selectedId, select, clear };
}
