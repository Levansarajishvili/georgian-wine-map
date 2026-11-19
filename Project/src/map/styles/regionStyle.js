// src/map/styles/regionStyle.js
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';

// The hovered region is drawn after every other one, so on a border two
// regions share its outline is not covered by the neighbour's casing.
const HOVER_Z_INDEX = 1;

/**
 * Neutral ADM1 style: a light casing with a dashed line on top, no fill.
 * Regions are context for the zones, so they carry no colour of their own.
 *
 * Hover (the region under the mouse) keeps the same two strokes and makes
 * them prominent: a wider casing and a thicker, solid, darker line.
 *
 * The Style objects of both states are created once and reused for every
 * feature; the returned function only chooses between them.
 *
 * @param {object} tokens mapTokens.region
 * @param {{ hoveredId: string|null }} state owned by regionsLayer; read on every render
 * @returns {import('ol/style/Style').StyleFunction}
 */
export function createRegionStyle(tokens, state) {
  const base = [
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

  const hovered = [
    new Style({
      stroke: new Stroke({
        color: tokens.casing,
        width: tokens.hover.casingWidth,
        lineJoin: 'round',
      }),
      zIndex: HOVER_Z_INDEX,
    }),
    new Style({
      stroke: new Stroke({
        color: tokens.hover.line,
        width: tokens.hover.lineWidth,
        lineJoin: 'round',
      }),
      zIndex: HOVER_Z_INDEX,
    }),
  ];

  return (feature) => (feature.getId() === state.hoveredId ? hovered : base);
}
