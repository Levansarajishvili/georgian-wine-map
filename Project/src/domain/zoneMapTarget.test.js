// src/domain/zoneMapTarget.test.js
import { describe, expect, it } from 'vitest';
import { getZoneMapTarget, hasZoneBoundary } from './zoneMapTarget';

/* SYNTHETIC fixtures: shapes of the data model, not wine data. */

const regionsById = new Map(
  [
    { id: 'east', name: { ka: 'აღმოსავლეთი' }, bbox: [45, 41, 46.7, 42.5] },
    { id: 'north', name: { ka: 'ჩრდილოეთი' }, bbox: [42.3, 42.3, 43.9, 42.9] },
    { id: 'broken', name: { ka: 'უყუთო' } },
  ].map((region) => [region.id, region]),
);

// What a zone without an outline looks like in zones.json (02 §4.5).
const placeholderZone = (regionIds) => ({
  id: 'zone',
  regions: regionIds.map((id) => ({ id })),
  boundary: { source: 'placeholder', verified: false },
  bbox: [0, 0, 0.001, 0.001],
});

describe('hasZoneBoundary', () => {
  it('is false for a placeholder or a missing boundary', () => {
    expect(hasZoneBoundary(placeholderZone(['east']))).toBe(false);
    expect(hasZoneBoundary({ id: 'zone' })).toBe(false);
  });

  it('is true for any real source, verified or not', () => {
    expect(hasZoneBoundary({ boundary: { source: 'osm-places', verified: false } })).toBe(true);
  });
});

describe('getZoneMapTarget', () => {
  it('shows a zone with a real outline by its own bbox', () => {
    const zone = {
      regions: [{ id: 'east' }],
      boundary: { source: 'osm-places', verified: false },
      bbox: [45.4, 41.9, 45.6, 42.1],
    };
    expect(getZoneMapTarget(zone, regionsById)).toEqual({
      kind: 'zone',
      bbox: [45.4, 41.9, 45.6, 42.1],
      regionNames: [],
    });
  });

  it('never uses the placeholder bbox at (0, 0): shows the region instead', () => {
    expect(getZoneMapTarget(placeholderZone(['east']), regionsById)).toEqual({
      kind: 'regions',
      bbox: [45, 41, 46.7, 42.5],
      regionNames: ['აღმოსავლეთი'],
    });
  });

  it('shows a two-region zone by the box around both regions', () => {
    expect(getZoneMapTarget(placeholderZone(['east', 'north']), regionsById)).toEqual({
      kind: 'regions',
      bbox: [42.3, 41, 46.7, 42.9],
      regionNames: ['აღმოსავლეთი', 'ჩრდილოეთი'],
    });
  });

  it('skips regions that are unknown or have no bbox', () => {
    const target = getZoneMapTarget(placeholderZone(['missing', 'broken', 'north']), regionsById);
    expect(target.bbox).toEqual([42.3, 42.3, 43.9, 42.9]);
    expect(target.regionNames).toEqual(['ჩრდილოეთი']);
  });

  it('returns null when there is nothing real to show', () => {
    expect(getZoneMapTarget(placeholderZone(['missing']), regionsById)).toBeNull();
    expect(getZoneMapTarget(placeholderZone([]), regionsById)).toBeNull();
    const realButMalformed = { boundary: { source: 'osm-places' }, bbox: [0, 0] };
    expect(getZoneMapTarget(realButMalformed, regionsById)).toBeNull();
  });
});
