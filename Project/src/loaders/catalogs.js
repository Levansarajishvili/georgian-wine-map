// src/loaders/catalogs.js
// Static imports of the attribute files: available synchronously on first render.
// Stage 5 needs only the zones index and the styles reference; grapes, regions,
// sources and the reverse indexes are added with the filter (stage 6).
import styles from '../data/styles.json';
import zones from '../data/zones.json';

/** @type {Map<string, object>} wine style slug → styles.json record */
export const stylesById = new Map(styles.map((style) => [style.id, style]));

/** @type {Map<string, object>} zone slug → zones.json record */
export const zonesById = new Map(zones.map((zone) => [zone.id, zone]));
