// src/domain/filterLogic.js
//
// Filter logic as pure functions: no React, no OpenLayers, no window, no data
// imports. Everything a function needs is passed in, so the whole file runs
// in Vitest's node environment.
//
// Vocabulary (01-architecture.md §3, 02-data-model.md §5):
//   dimension  'style' | 'grape'
//   filter     { style: string[], grape: string[] }, ids sorted, no duplicates
//   catalog    { styles: Style[], grapes: Grape[] }, records of styles.json / grapes.json
//   zones      records of zones.json (the zones index)
//
// Rules:
//   - OR inside a dimension, AND between dimensions;
//   - an empty filter matches every zone;
//   - an option's count is taken with the OTHER dimension's selection applied;
//   - an option is disabled when its count is 0 and it is not selected:
//     a selected option can always be switched off again.

/** Filter dimensions, in the order they are written to the URL. */
export const DIMENSIONS = ['style', 'grape'];

/** Dimension → the zone field that holds its link records (02 §4.5). */
const ZONE_LINKS = { style: 'styles', grape: 'grapes' };

/** Dimension → the catalog list with its options. */
const CATALOG_LIST = { style: 'styles', grape: 'grapes' };

const compareIds = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Catalog records of one dimension, in display order.
 * @param {{ styles: object[], grapes: object[] }} catalog
 * @param {'style'|'grape'} dimension
 */
export function getCatalogOptions(catalog, dimension) {
  return catalog?.[CATALOG_LIST[dimension]] ?? [];
}

/** @returns {{ style: string[], grape: string[] }} a new empty filter */
export function createEmptyFilter() {
  return { style: [], grape: [] };
}

/** @param {{ style: string[], grape: string[] }} filter */
export function isFilterEmpty(filter) {
  return DIMENSIONS.every((dimension) => filter[dimension].length === 0);
}

/** Ids a zone has in one dimension. */
function zoneIds(zone, dimension) {
  return (zone[ZONE_LINKS[dimension]] ?? []).map((link) => link.id);
}

/** OR inside the dimension; an empty selection accepts every zone. */
function matchesDimension(zone, filter, dimension) {
  const selected = filter[dimension];
  if (selected.length === 0) return true;
  const ids = zoneIds(zone, dimension);
  return selected.some((id) => ids.includes(id));
}

/**
 * Does the zone match the filter? AND between dimensions.
 *
 * @param {object} zone zones.json record
 * @param {{ style: string[], grape: string[] }} filter
 */
export function zoneMatches(zone, filter) {
  return DIMENSIONS.every((dimension) => matchesDimension(zone, filter, dimension));
}

/**
 * Ids of the zones that match the filter.
 *
 * @returns {Set<string>|null} null when the filter is empty: nothing is dimmed.
 *   An empty Set means the filter is set and no zone matches it.
 */
export function getMatchingZoneIds(zones, filter) {
  if (isFilterEmpty(filter)) return null;
  return new Set(zones.filter((zone) => zoneMatches(zone, filter)).map((zone) => zone.id));
}

/**
 * Options of one dimension with their counts and disabled state.
 *
 * count     zones that have the option AND match the other dimension's selection:
 *           the number the user gets by choosing this option alone in its group
 * total     zones that have the option, with no filter at all
 * disabled  count is 0 and the option is not selected
 * disabledReason
 *           'no-zones'  no zone has this option at all (total is 0)
 *           'conflict'  zones exist, but none of them matches the other dimension
 *           null        the option is not disabled
 *
 * @param {object[]} zones
 * @param {{ style: string[], grape: string[] }} filter
 * @param {'style'|'grape'} dimension
 * @param {object[]} options catalog records of that dimension, in display order
 */
export function getOptionCounts(zones, filter, dimension, options) {
  const others = DIMENSIONS.filter((other) => other !== dimension);
  const reachable = zones.filter((zone) =>
    others.every((other) => matchesDimension(zone, filter, other)),
  );
  const countIn = (list, id) =>
    list.reduce((count, zone) => count + (zoneIds(zone, dimension).includes(id) ? 1 : 0), 0);

  return options.map((option) => {
    const count = countIn(reachable, option.id);
    const total = countIn(zones, option.id);
    const selected = filter[dimension].includes(option.id);
    const disabled = count === 0 && !selected;
    return {
      id: option.id,
      label: option.name.ka,
      count,
      total,
      selected,
      disabled,
      disabledReason: disabled ? (total === 0 ? 'no-zones' : 'conflict') : null,
    };
  });
}

/**
 * Colour override for the zones layer (context.md, multi-style zones): while a
 * style filter is set, a matching zone takes the colour of the selected style
 * it has; with several of them, the one with the smallest `order`.
 * Without a style filter the Map is empty and the layer keeps its default.
 *
 * @returns {Map<string, string>} zone id → style slug
 */
export function getZoneColorKeys(zones, filter, styles) {
  const colorKeyById = new Map();
  if (filter.style.length === 0) return colorKeyById;

  const order = new Map(styles.map((style) => [style.id, style.order]));
  const byOrder = (a, b) =>
    (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER) ||
    compareIds(a, b);

  zones.forEach((zone) => {
    if (!zoneMatches(zone, filter)) return;
    const [first] = zoneIds(zone, 'style')
      .filter((id) => filter.style.includes(id))
      .sort(byOrder);
    if (first) colorKeyById.set(zone.id, first);
  });
  return colorKeyById;
}

/**
 * Everything the UI and the map derive from one filter value.
 *
 * @param {object[]} zones
 * @param {{ style: string[], grape: string[] }} filter
 * @param {{ styles: object[], grapes: object[] }} catalog
 */
export function computeFilterResult(zones, filter, catalog) {
  const matchingIds = getMatchingZoneIds(zones, filter);
  return {
    /** Set of matching zone ids, or null when the filter is empty. */
    matchingIds,
    matchCount: matchingIds === null ? zones.length : matchingIds.size,
    totalCount: zones.length,
    facets: {
      style: getOptionCounts(zones, filter, 'style', getCatalogOptions(catalog, 'style')),
      grape: getOptionCounts(zones, filter, 'grape', getCatalogOptions(catalog, 'grape')),
    },
    colorKeyById: getZoneColorKeys(zones, filter, catalog.styles),
  };
}

/* ------------------------------------------------------------------ *
 * Filter values
 * ------------------------------------------------------------------ */

/**
 * Adds the id to the dimension, or removes it when it is already there.
 * Returns a new filter; the argument is not changed.
 */
export function toggleFilterValue(filter, dimension, id) {
  if (!DIMENSIONS.includes(dimension)) return filter;
  const current = filter[dimension];
  const next = current.includes(id)
    ? current.filter((value) => value !== id)
    : [...current, id].sort(compareIds);
  return { ...filter, [dimension]: next };
}

/** Clears one dimension, or the whole filter when no dimension is given. */
export function clearFilter(filter, dimension) {
  if (dimension === undefined) return createEmptyFilter();
  if (!DIMENSIONS.includes(dimension)) return filter;
  return { ...filter, [dimension]: [] };
}

/* ------------------------------------------------------------------ *
 * Search by name and synonym
 * ------------------------------------------------------------------ */

/**
 * Search form of a string: lower case, hyphens and punctuation as spaces,
 * runs of spaces collapsed. "Semi-Sweet", "semi sweet" and " SEMI  SWEET "
 * are the same query. Georgian has no case; Mtavruli capitals fold to Mkhedruli.
 */
export function normalizeSearchText(text) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Options whose name or synonym contains the query (02 §4.2: the id is not a
 * search term). An empty query returns every option.
 *
 * @param {object[]} options catalog records: { id, name: { ka }, synonyms }
 * @param {string} query
 * @returns {{ id: string, matchedSynonym: string|null }[]} in the order of `options`.
 *   matchedSynonym is the synonym that matched when the name itself did not:
 *   the text for the "matched: orange wine" hint.
 */
export function searchOptions(options, query) {
  const needle = normalizeSearchText(query);
  if (needle === '') return options.map((option) => ({ id: option.id, matchedSynonym: null }));

  const results = [];
  options.forEach((option) => {
    if (normalizeSearchText(option.name?.ka).includes(needle)) {
      results.push({ id: option.id, matchedSynonym: null });
      return;
    }
    const synonym = (option.synonyms ?? []).find((candidate) =>
      normalizeSearchText(candidate).includes(needle),
    );
    if (synonym !== undefined) results.push({ id: option.id, matchedSynonym: synonym });
  });
  return results;
}

/* ------------------------------------------------------------------ *
 * URL query ↔ filter
 * ------------------------------------------------------------------ */

/** The query part of a search string, URL or path: no "?", no "#hash". */
function toQueryString(search) {
  if (typeof search !== 'string') return '';
  const withoutHash = search.split('#')[0];
  const mark = withoutHash.indexOf('?');
  return mark === -1 ? withoutHash : withoutHash.slice(mark + 1);
}

/** Decodes a query key; a malformed escape leaves the key as it is. */
function decodeQueryKey(rawKey) {
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, ' '));
  } catch {
    return rawKey;
  }
}

/**
 * URL query → filter. Never throws: whatever cannot be understood is ignored.
 *
 *   - only `style` and `grape` are read; other keys are not ours;
 *   - several values: comma, %2C or a repeated key;
 *   - a value is kept only if it is an id in the catalog (case and spaces
 *     around it are forgiven); duplicates collapse to one;
 *   - the result is canonical: ids sorted.
 *
 * @param {string} search "?style=amber&grape=saperavi", with or without "?"
 * @param {{ styles: object[], grapes: object[] }} catalog
 */
export function parseFilterParams(search, catalog) {
  const filter = createEmptyFilter();
  const query = toQueryString(search);
  if (query === '') return filter;

  // URLSearchParams replaces malformed escapes (%E0%A4%A) instead of throwing.
  const params = new URLSearchParams(query);

  DIMENSIONS.forEach((dimension) => {
    const known = new Set(getCatalogOptions(catalog, dimension).map((option) => option.id));
    const ids = new Set();
    params.getAll(dimension).forEach((value) => {
      value.split(',').forEach((part) => {
        const id = part.trim().toLowerCase();
        if (known.has(id)) ids.add(id);
      });
    });
    filter[dimension] = [...ids].sort(compareIds);
  });
  return filter;
}

/**
 * Filter → canonical query, without "?": dimensions in a fixed order, ids
 * sorted and joined with a plain comma, empty dimensions left out.
 * Ids are slugs ([a-z0-9-]), so nothing needs escaping.
 */
export function serializeFilter(filter) {
  return DIMENSIONS.filter((dimension) => filter[dimension].length > 0)
    .map((dimension) => `${dimension}=${[...filter[dimension]].sort(compareIds).join(',')}`)
    .join('&');
}

/**
 * The search string with its filter keys replaced by `filter`.
 * Parameters that are not ours (utm_*, zone, …) are kept exactly as written,
 * after the filter keys.
 *
 * @param {string} search current location.search
 * @param {{ style: string[], grape: string[] }} filter
 * @returns {string} query without "?"; '' when nothing is left
 */
export function mergeFilterIntoSearch(search, filter) {
  const foreign = toQueryString(search)
    .split('&')
    .filter((segment) => {
      if (segment === '') return false;
      return !DIMENSIONS.includes(decodeQueryKey(segment.split('=')[0]));
    });
  return [serializeFilter(filter), ...foreign].filter(Boolean).join('&');
}
