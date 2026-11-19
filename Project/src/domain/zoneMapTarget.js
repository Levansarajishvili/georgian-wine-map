// src/domain/zoneMapTarget.js

/** sources.json id of a record that has no data yet (02 §4.1). */
export const PLACEHOLDER_SOURCE = 'placeholder';

const isBBox = (value) =>
  Array.isArray(value) && value.length === 4 && value.every(Number.isFinite);

/** Whether the zone's outline is real data, not the placeholder at (0, 0). */
export function hasZoneBoundary(zone) {
  return Boolean(zone.boundary) && zone.boundary.source !== PLACEHOLDER_SOURCE;
}

/**
 * What the map shows for a zone: the answer to "show on the map" and to the
 * keyboard's "next zone".
 *
 * A zone with a real outline is shown itself: `zone.bbox`. A zone whose
 * outline is still a placeholder has no place of its own yet: its `bbox` and
 * geometry are dummies at (0, 0), in the Gulf of Guinea (02 §4.5), and
 * fitting the map to them takes the reader out of Georgia. Such a zone is
 * shown by its region instead; for a zone that crosses two regions, by both
 * (the smallest box around them).
 *
 * @param {object} zone zones.json record
 * @param {Map<string, object>} regionsById regions.json records by id
 * @returns {{ kind: 'zone'|'regions', bbox: number[], regionNames: string[] }|null}
 *   `bbox` is [minLon, minLat, maxLon, maxLat], EPSG:4326. `regionNames` are
 *   the regions the box was made of (empty for kind 'zone'). null: there is
 *   nothing real to show.
 */
export function getZoneMapTarget(zone, regionsById) {
  if (hasZoneBoundary(zone)) {
    return isBBox(zone.bbox) ? { kind: 'zone', bbox: zone.bbox, regionNames: [] } : null;
  }

  const regions = (zone.regions ?? [])
    .map((link) => regionsById.get(link.id))
    .filter((region) => region && isBBox(region.bbox));
  if (regions.length === 0) return null;

  return {
    kind: 'regions',
    bbox: regions
      .map((region) => region.bbox)
      .reduce((box, next) => [
        Math.min(box[0], next[0]),
        Math.min(box[1], next[1]),
        Math.max(box[2], next[2]),
        Math.max(box[3], next[3]),
      ]),
    regionNames: regions.map((region) => region.name.ka),
  };
}
