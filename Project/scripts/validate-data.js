// scripts/validate-data.js
//
// Validates the attribute files in src/data/ against 02-data-model.md:
//   - every record and every relation record has `source` and `verified` (§6)
//   - `source` points to an id in sources.json; placeholder => verified: false (§6, §9.7)
//   - ids are slugs and unique per file; link ids are unique per list (§2, §9.1–9.2)
//   - every link points to an existing id (§9.3)
// Geometry checks (§9.4–9.6, §9.8) are not here yet: they need the *.geo.json files.
//
// Usage:
//   node scripts/validate-data.js            dev: placeholder records are warnings
//   node scripts/validate-data.js --strict   production: placeholder records are errors
// Exit code 1 if there is at least one error. No dependencies.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DATA_DIR = fileURLToPath(new URL('../src/data/', import.meta.url));
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PLACEHOLDER_SOURCE = 'placeholder';
const STRICT = process.argv.includes('--strict');

const errors = [];
const warnings = [];
let placeholderCount = 0;

const error = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

async function loadArray(file) {
  let text;
  try {
    text = await readFile(path.join(DATA_DIR, file), 'utf8');
  } catch {
    error(file, 'file not found in src/data/');
    return [];
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    error(file, `invalid JSON (${e.message})`);
    return [];
  }
  if (!Array.isArray(data)) {
    error(file, 'top level must be an array');
    return [];
  }
  return data;
}

function recordLabel(file, record, index) {
  return isObject(record) && typeof record.id === 'string' && record.id !== ''
    ? `${file} › ${record.id}`
    : `${file} › [${index}]`;
}

function checkSlug(where, id) {
  if (typeof id !== 'string' || id === '') {
    error(where, 'missing id');
    return false;
  }
  if (!SLUG_RE.test(id)) {
    error(where, `id "${id}" is not a slug (a-z, 0-9, single hyphens)`);
  }
  return true;
}

// Unique slug ids within one file. Returns the set of valid ids for link checks.
function collectIds(file, records) {
  const firstIndex = new Map();
  records.forEach((record, index) => {
    const where = recordLabel(file, record, index);
    if (!isObject(record)) {
      error(where, 'record must be an object');
      return;
    }
    if (!checkSlug(where, record.id)) return;
    if (firstIndex.has(record.id)) {
      error(where, `duplicate id (first seen at index ${firstIndex.get(record.id)})`);
    } else {
      firstIndex.set(record.id, index);
    }
  });
  return new Set(firstIndex.keys());
}

// Provenance: source + verified (+ optional note) on any record or relation record.
function checkProvenance(where, value, sourceIds) {
  if (!isObject(value)) {
    error(where, 'expected an object with source and verified');
    return;
  }
  const { source, verified, note } = value;

  if (typeof source !== 'string' || source === '') {
    error(where, 'missing source');
  } else if (!sourceIds.has(source)) {
    error(where, `source "${source}" not found in sources.json`);
  }

  if (typeof verified !== 'boolean') {
    error(where, 'verified must be true or false');
  }

  if (note !== undefined && typeof note !== 'string') {
    error(where, 'note must be a string');
  }

  if (source === PLACEHOLDER_SOURCE) {
    placeholderCount += 1;
    if (verified === true) error(where, 'placeholder source cannot have verified: true');
  }
}

// A list of relation records on a zone: { id, source, verified, note? }[].
// targetIds = null means there is no catalog to check against (villages).
function checkLinkList(where, list, field, targetIds, targetFile, sourceIds) {
  if (!Array.isArray(list)) {
    error(where, `${field} must be an array`);
    return;
  }
  if (list.length === 0) {
    error(where, `${field} needs at least one item`);
  }
  const seen = new Set();
  list.forEach((link, index) => {
    const at = `${where} › ${field}[${index}]`;
    if (!isObject(link)) {
      error(at, 'link must be an object');
      return;
    }
    if (checkSlug(at, link.id)) {
      if (targetIds && !targetIds.has(link.id)) {
        error(at, `"${link.id}" not found in ${targetFile}`);
      }
      if (seen.has(link.id)) {
        error(at, `"${link.id}" appears more than once in ${field}`);
      }
      seen.add(link.id);
    }
    checkProvenance(at, link, sourceIds);
  });
}

const [sources, styles, grapes, regions, zones] = await Promise.all(
  ['sources.json', 'styles.json', 'grapes.json', 'regions.json', 'zones.json'].map(loadArray),
);

const sourceIds = collectIds('sources.json', sources);
const styleIds = collectIds('styles.json', styles);
const grapeIds = collectIds('grapes.json', grapes);
const regionIds = collectIds('regions.json', regions);
collectIds('zones.json', zones);

if (!sourceIds.has(PLACEHOLDER_SOURCE)) {
  error('sources.json', `reserved id "${PLACEHOLDER_SOURCE}" is missing`);
}

for (const [file, records] of [
  ['styles.json', styles],
  ['grapes.json', grapes],
  ['regions.json', regions],
]) {
  records.forEach((record, index) => {
    checkProvenance(recordLabel(file, record, index), record, sourceIds);
  });
}

zones.forEach((zone, index) => {
  const where = recordLabel('zones.json', zone, index);
  if (!isObject(zone)) return; // already reported by collectIds
  checkProvenance(where, zone, sourceIds);
  checkLinkList(where, zone.regions, 'regions', regionIds, 'regions.json', sourceIds);
  checkLinkList(where, zone.grapes, 'grapes', grapeIds, 'grapes.json', sourceIds);
  checkLinkList(where, zone.styles, 'styles', styleIds, 'styles.json', sourceIds);
  checkLinkList(where, zone.villages, 'villages', null, null, sourceIds);
  checkProvenance(`${where} › boundary`, zone.boundary, sourceIds);
});

if (placeholderCount > 0) {
  const message = `${placeholderCount} record(s) still use source "${PLACEHOLDER_SOURCE}"`;
  if (STRICT) error('src/data', `${message}; production build needs real sources`);
  else warn('src/data', message);
}

for (const line of warnings) console.warn(`warning  ${line}`);
for (const line of errors) console.error(`error    ${line}`);
console.log(
  `\nvalidate-data: ${errors.length} error(s), ${warnings.length} warning(s)` +
    (STRICT ? ' [strict]' : ''),
);

process.exitCode = errors.length > 0 ? 1 : 0;
