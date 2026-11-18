// src/domain/filterLogic.test.js
import { describe, expect, it } from 'vitest';
import {
  clearFilter,
  computeFilterResult,
  createEmptyFilter,
  getMatchingZoneIds,
  getOptionCounts,
  getZoneColorKeys,
  mergeFilterIntoSearch,
  normalizeSearchText,
  parseFilterParams,
  searchOptions,
  serializeFilter,
  toggleFilterValue,
  zoneMatches,
} from './filterLogic';

/* ------------------------------------------------------------------ *
 * Fixtures. SYNTHETIC: the zones below are test shapes, not wine data.
 * Style records copy styles.json (02 §4.2); grape and zone records only
 * follow the data model, and their links are invented for the tests.
 * ------------------------------------------------------------------ */

const styles = [
  { id: 'amber', name: { ka: 'ქარვისფერი ქვევრის' }, synonyms: ['amber', 'orange wine', 'კახური ტიპის'], order: 1 },
  { id: 'semi-sweet', name: { ka: 'ბუნებრივად ნახევრად ტკბილი' }, synonyms: ['semi-sweet', 'ნახევრად ტკბილი'], order: 2 },
  { id: 'sparkling', name: { ka: 'ცქრიალა' }, synonyms: ['sparkling'], order: 3 },
  { id: 'dry-white', name: { ka: 'თეთრი მშრალი' }, synonyms: ['dry white'], order: 4 },
  { id: 'dry-red', name: { ka: 'წითელი მშრალი' }, synonyms: ['dry red'], order: 5 },
];

const grapes = [
  { id: 'grape-a', name: { ka: 'ჯიში ა' }, synonyms: ['grape a'] },
  { id: 'grape-b', name: { ka: 'ჯიში ბ' }, synonyms: ['grape b'] },
  { id: 'grape-c', name: { ka: 'ჯიში გ' }, synonyms: ['grape c'] },
  // In the catalog, but no zone uses it.
  { id: 'grape-unused', name: { ka: 'ჯიში დ' }, synonyms: [] },
];

const catalog = { styles, grapes };

const link = (id) => ({ id, source: 'test-fixture', verified: false });
const zone = (id, styleIds, grapeIds) => ({
  id,
  name: { ka: id },
  styles: styleIds.map(link),
  grapes: grapeIds.map(link),
});

const zones = [
  zone('zone-1', ['amber', 'dry-white'], ['grape-a']),
  zone('zone-2', ['dry-red'], ['grape-b']),
  zone('zone-3', ['amber', 'dry-red'], ['grape-a', 'grape-b']),
  zone('zone-4', ['semi-sweet'], ['grape-c']),
];

const filterOf = (partial) => ({ ...createEmptyFilter(), ...partial });
const byId = (facet) => Object.fromEntries(facet.map((option) => [option.id, option]));

/* ------------------------------------------------------------------ */

describe('matching zones', () => {
  it('scenario 1: an empty filter dims nothing', () => {
    const filter = createEmptyFilter();

    expect(getMatchingZoneIds(zones, filter)).toBeNull();
    expect(zones.every((item) => zoneMatches(item, filter))).toBe(true);

    const result = computeFilterResult(zones, filter, catalog);
    expect(result.matchCount).toBe(4);
    expect(result.totalCount).toBe(4);
    expect(result.colorKeyById.size).toBe(0);
  });

  it('scenario 2: values of one dimension are joined with OR', () => {
    const filter = filterOf({ grape: ['grape-a', 'grape-c'] });

    expect([...getMatchingZoneIds(zones, filter)].sort()).toEqual(['zone-1', 'zone-3', 'zone-4']);
  });

  it('scenario 3: dimensions are joined with AND', () => {
    const filter = filterOf({ style: ['amber'], grape: ['grape-b'] });

    // zone-1 is amber without grape-b, zone-2 has grape-b without amber.
    expect([...getMatchingZoneIds(zones, filter)]).toEqual(['zone-3']);
  });

  it('scenario 4: a filter that matches nothing gives an empty Set, not null', () => {
    const filter = filterOf({ style: ['semi-sweet'], grape: ['grape-a'] });
    const result = computeFilterResult(zones, filter, catalog);

    expect(result.matchingIds).toEqual(new Set());
    expect(result.matchCount).toBe(0);
  });
});

describe('counts and disabled options', () => {
  it('scenario 5: without a filter every option shows all of its zones', () => {
    const { facets } = computeFilterResult(zones, createEmptyFilter(), catalog);
    const style = byId(facets.style);
    const grape = byId(facets.grape);

    expect(style.amber.count).toBe(2);
    expect(style['dry-red'].count).toBe(2);
    expect(style['dry-white'].count).toBe(1);
    expect(style['semi-sweet'].count).toBe(1);
    expect(grape['grape-a'].count).toBe(2);
    expect(grape['grape-b'].count).toBe(2);
    expect(grape['grape-c'].count).toBe(1);
    // Options keep the order of the catalog.
    expect(facets.style.map((option) => option.id)).toEqual(styles.map((item) => item.id));
  });

  it('scenario 6: an option nobody has is disabled with the reason "no-zones"', () => {
    const { facets } = computeFilterResult(zones, createEmptyFilter(), catalog);

    expect(byId(facets.style).sparkling).toMatchObject({
      count: 0,
      total: 0,
      disabled: true,
      disabledReason: 'no-zones',
    });
    expect(byId(facets.grape)['grape-unused']).toMatchObject({
      disabled: true,
      disabledReason: 'no-zones',
    });
  });

  it('scenario 7: counts follow the other dimension, and an empty option is disabled with the reason "conflict"', () => {
    const filter = filterOf({ style: ['amber'] });
    const { facets } = computeFilterResult(zones, filter, catalog);
    const grape = byId(facets.grape);

    expect(grape['grape-a'].count).toBe(2); // zone-1, zone-3
    expect(grape['grape-b'].count).toBe(1); // zone-3
    expect(grape['grape-c']).toMatchObject({
      count: 0,
      total: 1,
      disabled: true,
      disabledReason: 'conflict',
    });

    // The style counts are NOT narrowed by the style selection itself (OR inside the group).
    const style = byId(facets.style);
    expect(style.amber).toMatchObject({ count: 2, selected: true, disabled: false });
    expect(style['dry-red']).toMatchObject({ count: 2, selected: false, disabled: false });
  });

  it('scenario 8: a selected option is never disabled, even with a count of 0', () => {
    // Reachable only through the URL: the panel would not let the user pick this pair.
    const filter = filterOf({ style: ['semi-sweet'], grape: ['grape-a'] });
    const { facets } = computeFilterResult(zones, filter, catalog);

    expect(byId(facets.style)['semi-sweet']).toMatchObject({
      count: 0,
      selected: true,
      disabled: false,
      disabledReason: null,
    });
    expect(byId(facets.grape)['grape-a']).toMatchObject({
      count: 0,
      selected: true,
      disabled: false,
    });
  });

  it('getOptionCounts does not change its arguments', () => {
    const filter = filterOf({ style: ['amber'] });
    const snapshot = JSON.stringify({ zones, filter, grapes });

    getOptionCounts(zones, filter, 'grape', grapes);

    expect(JSON.stringify({ zones, filter, grapes })).toBe(snapshot);
  });
});

describe('search with synonyms', () => {
  it('scenario 9: "orange wine" finds the amber style and reports the synonym', () => {
    expect(searchOptions(styles, 'orange wine')).toEqual([
      { id: 'amber', matchedSynonym: 'orange wine' },
    ]);
  });

  it('scenario 10: case, extra spaces and hyphens do not matter', () => {
    expect(searchOptions(styles, '  ORANGE   Wine ')).toEqual([
      { id: 'amber', matchedSynonym: 'orange wine' },
    ]);
    expect(searchOptions(styles, 'semi sweet')).toEqual([
      { id: 'semi-sweet', matchedSynonym: 'semi-sweet' },
    ]);
    expect(searchOptions(styles, 'Dry-White')).toEqual([
      { id: 'dry-white', matchedSynonym: 'dry white' },
    ]);
    expect(normalizeSearchText(' Semi-Sweet ')).toBe('semi sweet');
  });

  it('scenario 11: a match in the Georgian name carries no synonym hint', () => {
    expect(searchOptions(styles, 'ქარვ')).toEqual([{ id: 'amber', matchedSynonym: null }]);
    // "მშრალი" is in two names; the order of the catalog is kept.
    expect(searchOptions(styles, 'მშრალი').map((match) => match.id)).toEqual([
      'dry-white',
      'dry-red',
    ]);
    // A Georgian synonym works like a Latin one.
    expect(searchOptions(styles, 'კახური')).toEqual([
      { id: 'amber', matchedSynonym: 'კახური ტიპის' },
    ]);
  });

  it('scenario 12: the id is not a search term, and an empty query returns everything', () => {
    // "grape-unused" has no synonyms; its id must not be searched.
    expect(searchOptions(grapes, 'unused')).toEqual([]);
    expect(searchOptions(styles, 'zzz')).toEqual([]);
    expect(searchOptions(styles, '   ')).toHaveLength(styles.length);
    expect(searchOptions(styles, undefined)).toHaveLength(styles.length);
  });
});

describe('URL parameters', () => {
  it('scenario 13: a valid URL becomes a canonical filter', () => {
    expect(parseFilterParams('?style=amber&grape=grape-b,grape-a', catalog)).toEqual({
      style: ['amber'],
      grape: ['grape-a', 'grape-b'],
    });
  });

  it('scenario 14: an invalid URL is ignored piece by piece and never throws', () => {
    const search =
      '?style=AMBER,,unknown-style,amber' + // case, empty value, unknown id, duplicate
      '&grape=%E0%A4%A' + // malformed percent-encoding
      '&grape=<script>alert(1)</script>' + // not an id
      '&grape=grape-b%2Cgrape-a' + // encoded comma
      '&grape=grape-a' + // repeated key, duplicate value
      '&colour=red' + // unknown key
      '&=&&style'; // empty key, empty segments, key without value

    expect(() => parseFilterParams(search, catalog)).not.toThrow();
    expect(parseFilterParams(search, catalog)).toEqual({
      style: ['amber'],
      grape: ['grape-a', 'grape-b'],
    });
  });

  it('scenario 15: unusable input gives an empty filter', () => {
    const empty = createEmptyFilter();

    expect(parseFilterParams('', catalog)).toEqual(empty);
    expect(parseFilterParams('?', catalog)).toEqual(empty);
    expect(parseFilterParams('?style=&grape=,,,', catalog)).toEqual(empty);
    expect(parseFilterParams('?style=%%%&grape=%', catalog)).toEqual(empty);
    expect(parseFilterParams(null, catalog)).toEqual(empty);
    expect(parseFilterParams(undefined, catalog)).toEqual(empty);
    expect(parseFilterParams(42, catalog)).toEqual(empty);
    // A style id in the grape key is unknown there, and the other way round.
    expect(parseFilterParams('?style=grape-a&grape=amber', catalog)).toEqual(empty);
    // A missing catalog must not throw either.
    expect(parseFilterParams('?style=amber', undefined)).toEqual(empty);
  });

  it('scenario 16: serialising is canonical and round-trips', () => {
    const filter = filterOf({ style: ['dry-red', 'amber'], grape: ['grape-b', 'grape-a'] });
    const query = serializeFilter(filter);

    expect(query).toBe('style=amber,dry-red&grape=grape-a,grape-b');
    expect(serializeFilter(parseFilterParams(`?${query}`, catalog))).toBe(query);
    expect(serializeFilter(createEmptyFilter())).toBe('');
    expect(serializeFilter(filterOf({ grape: ['grape-a'] }))).toBe('grape=grape-a');
  });

  it('scenario 17: writing the filter keeps parameters that are not ours', () => {
    const search = '?utm_source=news%20letter&style=unknown&zone=zone-1&grape=grape-a&grape=grape-a';
    const filter = parseFilterParams(search, catalog);

    expect(mergeFilterIntoSearch(search, filter)).toBe(
      'grape=grape-a&utm_source=news%20letter&zone=zone-1',
    );
    expect(mergeFilterIntoSearch(search, createEmptyFilter())).toBe(
      'utm_source=news%20letter&zone=zone-1',
    );
    expect(mergeFilterIntoSearch('?style=amber', createEmptyFilter())).toBe('');
    // A percent-encoded key is still our key.
    expect(mergeFilterIntoSearch('?%73tyle=amber', filterOf({ style: ['dry-red'] }))).toBe(
      'style=dry-red',
    );
  });
});

describe('changing the filter', () => {
  it('scenario 18: toggle adds, removes and keeps the ids sorted', () => {
    const empty = createEmptyFilter();
    const one = toggleFilterValue(empty, 'style', 'dry-red');
    const two = toggleFilterValue(one, 'style', 'amber');

    expect(one.style).toEqual(['dry-red']);
    expect(two.style).toEqual(['amber', 'dry-red']);
    expect(toggleFilterValue(two, 'style', 'dry-red').style).toEqual(['amber']);
    // The argument is not changed, and an unknown dimension is ignored.
    expect(empty).toEqual(createEmptyFilter());
    expect(toggleFilterValue(two, 'region', 'kakheti')).toBe(two);
  });

  it('scenario 19: clear empties one dimension or the whole filter', () => {
    const filter = filterOf({ style: ['amber'], grape: ['grape-a'] });

    expect(clearFilter(filter, 'style')).toEqual({ style: [], grape: ['grape-a'] });
    expect(clearFilter(filter)).toEqual(createEmptyFilter());
  });
});

describe('zone colour under a style filter', () => {
  it('scenario 20: a matching zone takes the colour of the selected style', () => {
    // zone-1 is amber by default (order 1); under the dry-white filter it turns dry-white.
    const colors = getZoneColorKeys(zones, filterOf({ style: ['dry-white'] }), styles);

    expect(colors.get('zone-1')).toBe('dry-white');
    expect(colors.has('zone-2')).toBe(false); // does not match: dimmed, no colour
  });

  it('scenario 21: with several selected styles the smallest order wins', () => {
    const colors = getZoneColorKeys(zones, filterOf({ style: ['dry-red', 'amber'] }), styles);

    expect(colors.get('zone-3')).toBe('amber'); // has both; amber is order 1
    expect(colors.get('zone-2')).toBe('dry-red');
    expect(colors.get('zone-1')).toBe('amber');
  });

  it('scenario 22: a grape-only filter leaves the default colours alone', () => {
    expect(getZoneColorKeys(zones, filterOf({ grape: ['grape-a'] }), styles).size).toBe(0);
  });
});
