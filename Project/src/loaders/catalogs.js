// src/loaders/catalogs.js
// Static imports of the attribute files: available synchronously on first render.
// Stage 5: the zones index and the styles reference.
// Stage 6: grapes, plus the lists the filter works on.
// Stage 7: regions, sources and the region → zones reverse index, for the
// zone panel and the region list.
import grapeRecords from '../data/grapes.json';
import regionRecords from '../data/regions.json';
import sourceRecords from '../data/sources.json';
import styleRecords from '../data/styles.json';
import zoneRecords from '../data/zones.json';

const byId = (records) => new Map(records.map((record) => [record.id, record]));

/** @type {Map<string, object>} wine style slug → styles.json record */
export const stylesById = byId(styleRecords);

/** @type {Map<string, object>} grape slug → grapes.json record */
export const grapesById = byId(grapeRecords);

/** @type {Map<string, object>} region slug → regions.json record */
export const regionsById = byId(regionRecords);

/** @type {Map<string, object>} source id → sources.json record */
export const sourcesById = byId(sourceRecords);

/** @type {Map<string, object>} zone slug → zones.json record */
export const zonesById = byId(zoneRecords);

/** The zones index as a list: what the filter counts and matches. */
export const zones = zoneRecords;

const collator = new Intl.Collator('ka');
const byGeorgianName = (a, b) => collator.compare(a.name.ka, b.name.ka);

/** Regions in the order of the Georgian alphabet: the order of the region list. */
export const regions = [...regionRecords].sort(byGeorgianName);

/**
 * Reverse index (02 §1: a relation is stored once, in the zone).
 * A zone that crosses two regions is listed under both (02 §4.5).
 * Every region has an entry; a region without zones has an empty list.
 *
 * @type {Map<string, object[]>} region slug → its zones, by Georgian name
 */
export const zonesByRegionId = new Map(regionRecords.map((region) => [region.id, []]));
zoneRecords.forEach((zone) => {
  zone.regions.forEach((link) => zonesByRegionId.get(link.id)?.push(zone));
});
zonesByRegionId.forEach((list) => list.sort(byGeorgianName));

/**
 * Filter options in display order (domain/filterLogic.js takes this object):
 *   styles  by `order` (02 §2)
 *   grapes  by Georgian name
 */
export const filterCatalog = {
  styles: [...styleRecords].sort((a, b) => a.order - b.order),
  grapes: [...grapeRecords].sort(byGeorgianName),
};
