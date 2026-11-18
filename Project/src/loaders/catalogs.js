// src/loaders/catalogs.js
// Static imports of the attribute files: available synchronously on first render.
// Stage 5: the zones index and the styles reference.
// Stage 6: grapes, plus the lists the filter works on. Regions, sources and the
// reverse indexes come with the stages that need them.
import grapeRecords from '../data/grapes.json';
import styleRecords from '../data/styles.json';
import zoneRecords from '../data/zones.json';

/** @type {Map<string, object>} wine style slug → styles.json record */
export const stylesById = new Map(styleRecords.map((style) => [style.id, style]));

/** @type {Map<string, object>} zone slug → zones.json record */
export const zonesById = new Map(zoneRecords.map((zone) => [zone.id, zone]));

/** The zones index as a list: what the filter counts and matches. */
export const zones = zoneRecords;

const collator = new Intl.Collator('ka');

/**
 * Filter options in display order (domain/filterLogic.js takes this object):
 *   styles  by `order` (02 §2)
 *   grapes  by Georgian name
 */
export const filterCatalog = {
  styles: [...styleRecords].sort((a, b) => a.order - b.order),
  grapes: [...grapeRecords].sort((a, b) => collator.compare(a.name.ka, b.name.ka)),
};
