// src/state/useUrlFilters.js
import { useEffect, useSyncExternalStore } from 'react';
import {
  clearFilter,
  computeFilterResult,
  mergeFilterIntoSearch,
  parseFilterParams,
  serializeFilter,
  toggleFilterValue,
} from '../domain/filterLogic';
import { filterCatalog, zones } from '../loaders/catalogs';

/**
 * The filter lives in the URL and nowhere else (01 §5):
 *
 *   ?style=amber&grape=rkatsiteli,saperavi
 *
 * There is no React state holding a copy of it. Components read
 * `location.search` through useSyncExternalStore, and every change is written
 * back with history.replaceState, so a link reproduces the screen exactly and
 * back/forward need no extra code. replaceState, not pushState: ticking five
 * options must not put five steps between the user and the previous page.
 *
 * Parameters that are not ours (utm_*, zone, …) are left untouched.
 * Unknown or malformed values are ignored and then removed from the address
 * bar: after the first render the URL is in canonical form.
 *
 * Until state/urlState.js exists (01 §3) this is the only module that touches
 * window.history. When the selected zone moves into the URL, the three
 * functions below (subscribe, readSearch, writeSearch) move there unchanged.
 */

/** @type {Set<() => void>} */
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  // back/forward. replaceState does not fire popstate; writeSearch() notifies itself.
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

const readSearch = () => window.location.search;

// No server rendering in this app; an empty query keeps the hook safe without window.
const readServerSearch = () => '';

/** @param {string} query without "?" */
function writeSearch(query) {
  const { pathname, hash } = window.location;
  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${query ? `?${query}` : ''}${hash}`,
  );
  listeners.forEach((listener) => listener());
}

/**
 * search string → { filter, result }, shared by every component that uses the
 * hook. Cached by the canonical query, so "?grape=b,a" and "?grape=a,b" give
 * the same objects and effects that depend on them do not run twice.
 */
let cache = { key: null, value: null };

function derive(search) {
  const filter = parseFilterParams(search, filterCatalog);
  const key = serializeFilter(filter);
  if (cache.key !== key) {
    cache = { key, value: { filter, result: computeFilterResult(zones, filter, filterCatalog) } };
  }
  return cache.value;
}

const currentFilter = () => derive(readSearch()).filter;

function writeFilter(filter) {
  writeSearch(mergeFilterIntoSearch(readSearch(), filter));
}

/**
 * Switches one option on or off.
 * @param {'style'|'grape'} dimension
 * @param {string} id
 */
function toggle(dimension, id) {
  writeFilter(toggleFilterValue(currentFilter(), dimension, id));
}

/**
 * Clears one dimension, or the whole filter when called without arguments.
 * @param {'style'|'grape'} [dimension]
 */
function clear(dimension) {
  writeFilter(clearFilter(currentFilter(), dimension));
}

/**
 * Filter from the URL, what is derived from it, and the actions that change it.
 *
 * Any component may call this hook; all of them read the same URL and get the
 * same `filter` and `result` objects. `toggle` and `clear` are stable.
 *
 * @returns {{
 *   filter: { style: string[], grape: string[] },
 *   result: ReturnType<typeof computeFilterResult>,
 *   toggle: (dimension: 'style'|'grape', id: string) => void,
 *   clear: (dimension?: 'style'|'grape') => void,
 * }}
 */
export function useUrlFilters() {
  const search = useSyncExternalStore(subscribe, readSearch, readServerSearch);
  const { filter, result } = derive(search);

  // Canonical URL: drop what parse ignored, sort the rest. Idempotent, so
  // several components running it (and StrictMode running it twice) is fine.
  useEffect(() => {
    const canonical = mergeFilterIntoSearch(search, filter);
    if (canonical !== search.replace(/^\?/, '')) writeSearch(canonical);
  }, [search, filter]);

  return { filter, result, toggle, clear };
}
