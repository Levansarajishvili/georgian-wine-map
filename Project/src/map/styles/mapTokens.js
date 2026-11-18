// src/map/styles/mapTokens.js

/**
 * Reads map tokens from tokens.css at runtime (getComputedStyle) and converts
 * them to values OpenLayers accepts: canvas styles cannot resolve var(--…).
 * The only module style functions take colours from.
 *
 * Stage 4 reads the region group and the map motion duration.
 * Zone tokens (--map-zone-*, --map-marker-*, …) are added with the zones layer.
 */

function createReader(element) {
  const computed = getComputedStyle(element);

  const string = (name) => {
    const value = computed.getPropertyValue(name).trim();
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

  return { string, number, numberList, milliseconds };
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
    },
    motion: {
      // 0 under prefers-reduced-motion: fit/animate then run without animation.
      mapDuration: read.milliseconds('--motion-duration-map'),
    },
  };
}
