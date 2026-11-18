// src/map/styles/regionStyle.js
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';

/**
 * Neutral ADM1 style: a light casing with a dashed line on top, no fill.
 * Regions are context for the zones, so they carry no colour of their own.
 * Both Style objects are created once and reused for every feature.
 *
 * @param {{ line: string, lineWidth: number, lineDash: number[], casing: string, casingWidth: number }} tokens
 * @returns {import('ol/style/Style').default[]}
 */
export function createRegionStyle(tokens) {
  return [
    new Style({
      stroke: new Stroke({
        color: tokens.casing,
        width: tokens.casingWidth,
        lineJoin: 'round',
      }),
    }),
    new Style({
      stroke: new Stroke({
        color: tokens.line,
        width: tokens.lineWidth,
        lineDash: tokens.lineDash,
        lineJoin: 'round',
      }),
    }),
  ];
}
