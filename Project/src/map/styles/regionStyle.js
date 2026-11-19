// src/map/styles/regionStyle.js
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';

/**
 * Neutral ADM1 style: a light casing with a dashed line on top, no fill.
 * Regions are context for the zones, so they carry no colour of their own.
 *
 * The same for every region and in every state: the hovered region keeps this
 * outline on the ground, and its wall rises from it in another layer
 * (regionWallLayer). The Style objects are created once and reused.
 *
 * @param {object} tokens mapTokens.region
 * @returns {Style[]}
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
