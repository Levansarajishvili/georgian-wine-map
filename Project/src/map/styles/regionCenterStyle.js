// src/map/styles/regionCenterStyle.js
import { DEVICE_PIXEL_RATIO } from 'ol/has';
import Icon from 'ol/style/Icon';
import Style from 'ol/style/Style';

/**
 * Location pin, drawn once on a canvas at device resolution: a round head
 * that narrows to a tip, with a dot in the head. The tip is the anchor.
 *
 * @param {object} tokens mapTokens.regionCenter
 * @param {number} pixelRatio
 * @returns {Icon|null} null where there is no 2D context (unit tests)
 */
function createPinIcon(tokens, pixelRatio) {
  const { height, radius, dotRadius, casingWidth } = tokens;
  // The casing is stroked around the body, so it needs room on every side.
  const bleed = Math.ceil(casingWidth) + 1;
  const width = 2 * (radius + bleed);
  const fullHeight = height + 2 * bleed;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * pixelRatio);
  canvas.height = Math.ceil(fullHeight * pixelRatio);
  const context = canvas.getContext?.('2d') ?? null;
  if (!context) return null;
  context.scale(pixelRatio, pixelRatio);

  const centerX = width / 2;
  const headY = bleed + radius;
  const tipY = bleed + height;
  // The two sides are tangents from the tip to the head; `spread` is the
  // angle between the vertical and the radius to a point of tangency.
  const spread = Math.acos(radius / (tipY - headY));

  context.beginPath();
  context.moveTo(centerX, tipY);
  // Canvas angles grow clockwise from "east": from the lower-left point of
  // tangency over the top of the head to the lower-right one.
  context.arc(centerX, headY, radius, Math.PI / 2 + spread, 2.5 * Math.PI - spread);
  context.closePath();

  context.lineJoin = 'round';
  context.strokeStyle = tokens.casing;
  context.lineWidth = 2 * casingWidth;
  context.stroke();
  context.fillStyle = tokens.fill;
  context.fill();

  context.beginPath();
  context.arc(centerX, headY, dotRadius, 0, 2 * Math.PI);
  context.fillStyle = tokens.dot;
  context.fill();

  return new Icon({
    img: canvas,
    // The canvas is drawn at device resolution, so it is scaled back to CSS px.
    scale: 1 / pixelRatio,
    // The tip of the body, not the bottom of the image: the casing goes below it.
    anchor: [0.5, tipY / fullHeight],
    // Always drawn; zone labels keep clear of it (see regionCentersLayer).
    declutterMode: 'obstacle',
  });
}

/**
 * Style of a regional centre: one pin, the same for every centre and in every
 * state. It has no hover, selected or filtered look: the pin only says where
 * the administrative centre of the region is.
 *
 * @param {object} tokens mapTokens.regionCenter
 * @param {number} [pixelRatio]
 * @returns {Style}
 */
export function createRegionCenterStyle(tokens, pixelRatio = DEVICE_PIXEL_RATIO) {
  return new Style({ image: createPinIcon(tokens, pixelRatio) ?? undefined });
}
