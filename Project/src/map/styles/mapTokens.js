// src/map/styles/mapTokens.js

/**
 * Reads map tokens from tokens.css at runtime (getComputedStyle) and converts
 * them to values OpenLayers accepts: canvas styles cannot resolve var(--…).
 * The only module style functions take colours from.
 *
 * Stage 4: region group and the map motion duration.
 * Stage 5: zone group (styles, states, patterns, marker, chip, label).
 */

/**
 * Wine style slugs that have a --map-zone-<slug>-* token group.
 * Must match styles.json; map/ does not import data files, so the list is
 * repeated here on purpose.
 */
export const ZONE_STYLE_IDS = ['amber', 'semi-sweet', 'sparkling', 'dry-white', 'dry-red'];

function createReader(element) {
  const computed = getComputedStyle(element);

  const optional = (name) => computed.getPropertyValue(name).trim() || null;

  const string = (name) => {
    const value = optional(name);
    if (!value) {
      throw new Error(`[mapTokens] ${name} is empty: is styles/tokens.css imported before the map is created?`);
    }
    return value;
  };

  const number = (name) => {
    const value = Number(string(name));
    if (Number.isNaN(value)) throw new Error(`[mapTokens] ${name} is not a number.`);
    return value;
  };

  const numberList = (name) => string(name).split(/\s+/).map(Number);

  const milliseconds = (name) => {
    const value = string(name);
    return value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000;
  };

  return { optional, string, number, numberList, milliseconds };
}

function readZoneStyle(read, id) {
  const prefix = `--map-zone-${id}`;
  return {
    fill: read.string(`${prefix}-fill`),
    line: read.string(`${prefix}-line`),
    /** 'none' | 'hatch' | 'bubbles' */
    pattern: read.string(`${prefix}-pattern`),
    patternInk: read.optional(`${prefix}-pattern-ink`),
    patternRing: read.optional(`${prefix}-pattern-ring`),
    /** 'circle' | 'square' | 'triangle' | 'diamond' | 'star' */
    marker: read.string(`${prefix}-marker`),
  };
}

export function readMapTokens(element = document.documentElement) {
  const read = createReader(element);
  return {
    region: {
      line: read.string('--map-region-line'),
      lineWidth: read.number('--map-region-line-width'),
      lineDash: read.numberList('--map-region-line-dash'),
      casing: read.string('--map-region-casing'),
      casingWidth: read.number('--map-region-casing-width'),
      hover: {
        line: read.string('--map-region-line-hover'),
        lineWidth: read.number('--map-region-line-width-hover'),
        casingWidth: read.number('--map-region-casing-width-hover'),
      },
    },
    zone: {
      /** Keyed by wine style slug. */
      styles: Object.fromEntries(ZONE_STYLE_IDS.map((id) => [id, readZoneStyle(read, id)])),
      fillOpacity: {
        base: read.number('--map-zone-fill-opacity'),
        imagery: read.number('--map-zone-fill-opacity-imagery'),
        hover: read.number('--map-zone-fill-opacity-hover'),
        hoverImagery: read.number('--map-zone-fill-opacity-hover-imagery'),
      },
      casing: read.string('--map-zone-casing'),
      lineWidth: read.number('--map-zone-line-width'),
      casingWidth: read.number('--map-zone-casing-width'),
      hover: {
        lineWidth: read.number('--map-zone-line-width-hover'),
        casingWidth: read.number('--map-zone-casing-width-hover'),
      },
      selected: {
        line: read.string('--map-zone-selected-line'),
        lineWidth: read.number('--map-zone-line-width-selected'),
        casingWidth: read.number('--map-zone-casing-width-selected'),
      },
      dimmed: {
        fill: read.string('--map-zone-dimmed-fill'),
        fillOpacity: read.number('--map-zone-dimmed-fill-opacity'),
        line: read.string('--map-zone-dimmed-line'),
        lineWidth: read.number('--map-zone-dimmed-line-width'),
        casingWidth: read.number('--map-zone-dimmed-casing-width'),
      },
      pattern: {
        spacing: read.number('--map-pattern-spacing'),
        lineWidth: read.number('--map-pattern-line-width'),
        bubbleRadius: read.number('--map-pattern-bubble-radius'),
        bubbleRingWidth: read.number('--map-pattern-bubble-ring-width'),
      },
      marker: {
        radius: read.number('--map-marker-radius'),
        hitRadius: read.number('--map-marker-hit-radius'),
        lineWidth: read.number('--map-marker-line-width'),
        casingWidth: read.number('--map-marker-casing-width'),
      },
      chip: {
        background: read.string('--map-chip-bg'),
        line: read.string('--map-chip-line'),
        lineWidth: read.number('--map-chip-line-width'),
        markerRadius: read.number('--map-chip-marker-radius'),
        markerLineWidth: read.number('--map-chip-marker-line-width'),
      },
      label: {
        fontFamily: read.string('--map-label-font-family'),
        fontWeight: read.string('--map-label-font-weight'),
        fontSize: read.number('--map-label-font-size'),
        color: read.string('--map-label-color'),
        colorDimmed: read.string('--map-label-color-dimmed'),
        halo: read.string('--map-label-halo'),
        haloWidth: read.number('--map-label-halo-width'),
        gap: read.number('--map-label-gap'),
      },
    },
    motion: {
      // 0 under prefers-reduced-motion: fit/animate then run without animation.
      mapDuration: read.milliseconds('--motion-duration-map'),
    },
  };
}
