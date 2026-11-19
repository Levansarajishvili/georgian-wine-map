// src/map/styles/zoneStyles.js
import { asArray } from 'ol/color';
import { DEVICE_PIXEL_RATIO } from 'ol/has';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Icon from 'ol/style/Icon';
import RegularShape from 'ol/style/RegularShape';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';

/**
 * Style function for wine zones.
 *
 * Feature contract (set by loaders/geometry.js and layers/zonesLayer.js):
 *   id               zone slug (feature.getId())
 *   name             label text
 *   styleIds         wine style slugs sorted by styles.json `order`; the first one is
 *                    the zone's default colour (multi-style rule, context.md)
 *   labelGeometry    ol/geom/Point at the zone's labelPoint, in the view projection
 *   span             larger side of the geometry extent, in projection units
 *   rank             0 = largest zone; smaller zones get a higher rank
 *
 * State contract (owned by zonesLayer, read on every call):
 *   matchingIds      Set of zone ids that match the filter, or null when there is no filter
 *   colorKeyById     Map zone id → style slug that overrides the default colour
 *   selectedId, hoveredId
 *   imagery          true while the satellite basemap is visible (denser fills)
 *
 * Colours, widths and sizes come from mapTokens only. The constants below are
 * behaviour, not design.
 */

/** Labels are drawn from this zoom level up. Assumption: check on real geometry. */
export const LABEL_MIN_ZOOM = 9;

/** Guards the comparison at exactly LABEL_MIN_ZOOM against float noise. */
const RESOLUTION_EPSILON = 1e-9;

/**
 * Draw order inside the layer. Each state has its own band, and the zone's
 * rank orders zones inside a band, so a smaller zone is always drawn above a
 * larger one. Fills are below every outline: a boundary is never hidden by
 * another zone's fill.
 * Labels and markers are decluttered together; there a higher value means
 * higher priority (it is placed first).
 */
const BAND = 1000;
const Z = {
  fill: 0,
  casing: BAND,
  line: 2 * BAND,
  hover: 3 * BAND,
  selected: 3 * BAND + 10,
  labelDimmed: 4 * BAND,
  label: 5 * BAND,
  marker: 6 * BAND,
  markerHover: 7 * BAND,
  markerSelected: 7 * BAND + 10,
  labelHover: 8 * BAND,
  labelSelected: 8 * BAND + 10,
};

/** Marker proportions taken from the palette board (shapes drawn for radius 7). */
const SQUARE_HALF_SIDE = 6 / 7;
const STAR_INNER_RADIUS = 3.2 / 7;

/** Chip proportions from the palette board, in units of the mini marker radius. */
const CHIP_PADDING_X = 1.5;
const CHIP_PADDING_Y = 1;
const CHIP_GAP = 2.5;

const labelGeometry = (feature) => feature.get('labelGeometry');

function withOpacity(color, opacity) {
  const [red, green, blue] = asArray(color);
  return [red, green, blue, opacity];
}

/**
 * True when the zone is too small on screen to be read as an area and is
 * drawn as a centroid marker instead. Shared by the style function and by
 * hit detection (zonesLayer.pickAt), so what is drawn is what is clicked.
 *
 * @param {import('ol/Feature').default} feature
 * @param {number} resolution
 * @param {number} markerMaxSizePx see getMarkerMaxSizePx()
 */
export function isZoneMarker(feature, resolution, markerMaxSizePx) {
  return feature.get('span') / resolution < markerMaxSizePx;
}

/**
 * A polygon smaller than the marker's own pointer target (24×24 CSS px,
 * WCAG 2.5.8) becomes a marker.
 *
 * @param {object} zoneTokens mapTokens.zone
 */
export function getMarkerMaxSizePx(zoneTokens) {
  return 2 * zoneTokens.marker.hitRadius;
}

/* ------------------------------------------------------------------
 * Canvas helpers: patterns and the multi-style chip
 * ---------------------------------------------------------------- */

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  // No 2D context in non-browser environments (unit tests): callers skip the drawing.
  const context = canvas.getContext?.('2d') ?? null;
  return { canvas, context };
}

/**
 * Second, non-colour sign of a wine style, drawn over the fill.
 * The pattern is anchored to the screen, not to the map: it does not move
 * with the polygon while panning.
 *
 * @returns {Fill|null}
 */
function createPatternFill(styleTokens, patternTokens, pixelRatio) {
  if (styleTokens.pattern !== 'hatch' && styleTokens.pattern !== 'bubbles') return null;

  const size = Math.round(patternTokens.spacing * pixelRatio);
  const { canvas, context } = createCanvas(size, size);
  if (!context) return null;

  if (styleTokens.pattern === 'hatch') {
    context.strokeStyle = styleTokens.patternInk ?? styleTokens.line;
    context.lineWidth = patternTokens.lineWidth * pixelRatio;
    // See-through like the fill under it: the basemap stays readable.
    context.globalAlpha = patternTokens.hatchOpacity;
    context.beginPath();
    context.moveTo(size / 2, 0);
    context.lineTo(size / 2, size);
    context.stroke();
  } else {
    context.beginPath();
    context.arc(size / 2, size / 2, patternTokens.bubbleRadius * pixelRatio, 0, 2 * Math.PI);
    context.fillStyle = styleTokens.patternInk ?? styleTokens.line;
    context.fill();
    context.strokeStyle = styleTokens.patternRing ?? styleTokens.line;
    context.lineWidth = patternTokens.bubbleRingWidth * pixelRatio;
    context.stroke();
  }

  const pattern = context.createPattern(canvas, 'repeat');
  if (!pattern) return null;
  // Vertical lines rotated by 45°: a seamless diagonal hatch at the exact spacing.
  if (styleTokens.pattern === 'hatch') pattern.setTransform(new DOMMatrix().rotateSelf(45));
  return new Fill({ color: pattern });
}

/** Traces a marker shape centred on (x, y). The caller fills and strokes it. */
function traceShape(context, shape, x, y, radius) {
  context.beginPath();
  if (shape === 'square') {
    const half = radius * SQUARE_HALF_SIDE;
    context.rect(x - half, y - half, 2 * half, 2 * half);
    return;
  }
  const points = { triangle: 3, diamond: 4, star: 10 }[shape];
  if (!points) {
    context.arc(x, y, radius, 0, 2 * Math.PI);
    return;
  }
  for (let index = 0; index < points; index += 1) {
    const pointRadius = shape === 'star' && index % 2 === 1 ? radius * STAR_INNER_RADIUS : radius;
    const angle = (index * 2 * Math.PI) / points - Math.PI / 2;
    context.lineTo(x + pointRadius * Math.cos(angle), y + pointRadius * Math.sin(angle));
  }
  context.closePath();
}

/**
 * Chip for a zone with several wine styles: a pill with one mini marker per
 * style, in `styleIds` order. Drawn once per combination and cached.
 *
 * @returns {{ icon: Icon, height: number }|null}
 */
function createChip(styleIds, zoneTokens, pixelRatio, declutterMode) {
  const { chip, styles } = zoneTokens;
  const radius = chip.markerRadius;
  const height = 2 * radius * (1 + CHIP_PADDING_Y);
  const width =
    2 * radius * (CHIP_PADDING_X + styleIds.length) + radius * CHIP_GAP * (styleIds.length - 1);
  // One CSS px of slack on every side so the border is not clipped.
  const bleed = Math.ceil(chip.lineWidth);

  const { canvas, context } = createCanvas(
    (width + 2 * bleed) * pixelRatio,
    (height + 2 * bleed) * pixelRatio,
  );
  if (!context) return null;
  context.scale(pixelRatio, pixelRatio);
  context.translate(bleed, bleed);
  context.lineJoin = 'round';

  context.beginPath();
  context.roundRect(0, 0, width, height, height / 2);
  context.fillStyle = chip.background;
  context.fill();
  context.strokeStyle = chip.line;
  context.lineWidth = chip.lineWidth;
  context.stroke();

  styleIds.forEach((styleId, index) => {
    const styleTokens = styles[styleId];
    if (!styleTokens) return;
    const x = radius * (CHIP_PADDING_X + 1) + index * radius * (2 + CHIP_GAP);
    traceShape(context, styleTokens.marker, x, height / 2, radius);
    context.fillStyle = styleTokens.fill;
    context.fill();
    context.strokeStyle = styleTokens.line;
    context.lineWidth = chip.markerLineWidth;
    context.stroke();
  });

  return {
    // The canvas is drawn at device resolution, so it is scaled back to CSS px.
    icon: new Icon({ img: canvas, scale: 1 / pixelRatio, declutterMode }),
    height,
  };
}

/** Marker shape as an OpenLayers image; `fill` and `stroke` are shared objects. */
function createMarkerImage(shape, radius, fill, stroke) {
  // 'obstacle': a marker is always drawn, and labels keep clear of it.
  const base = { fill, stroke, declutterMode: 'obstacle' };
  switch (shape) {
    case 'square':
      return new RegularShape({
        ...base,
        points: 4,
        radius: radius * SQUARE_HALF_SIDE * Math.SQRT2,
        angle: Math.PI / 4,
      });
    case 'triangle':
      return new RegularShape({ ...base, points: 3, radius });
    case 'diamond':
      return new RegularShape({ ...base, points: 4, radius });
    case 'star':
      return new RegularShape({ ...base, points: 5, radius, radius2: radius * STAR_INNER_RADIUS });
    default:
      return new CircleStyle({ ...base, radius });
  }
}

/* ------------------------------------------------------------------
 * Style function
 * ---------------------------------------------------------------- */

/**
 * @param {object} options
 * @param {object} options.tokens mapTokens.zone
 * @param {object} options.state style state owned by zonesLayer (see the file header)
 * @param {number} options.labelMaxResolution view resolution at LABEL_MIN_ZOOM
 * @param {number} [options.pixelRatio]
 * @returns {{ style: import('ol/style/Style').StyleFunction, clearCache: () => void }}
 */
export function createZoneStyle({ tokens, state, labelMaxResolution, pixelRatio = DEVICE_PIXEL_RATIO }) {
  const markerMaxSizePx = getMarkerMaxSizePx(tokens);
  const labelFont = `${tokens.label.fontWeight} ${tokens.label.fontSize}px ${tokens.label.fontFamily}`;

  /** Style arrays, keyed by zone and state. Cleared when features or tokens change. */
  const cache = new Map();
  /** Shared pieces that do not depend on the zone. */
  const patternFills = new Map();
  const chips = new Map();
  const warned = new Set();

  function getPatternFill(colorKey) {
    if (!patternFills.has(colorKey)) {
      patternFills.set(
        colorKey,
        createPatternFill(tokens.styles[colorKey], tokens.pattern, pixelRatio),
      );
    }
    return patternFills.get(colorKey);
  }

  function getChip(styleIds, declutterMode) {
    const key = `${styleIds.join(',')}|${declutterMode}`;
    if (!chips.has(key)) chips.set(key, createChip(styleIds, tokens, pixelRatio, declutterMode));
    return chips.get(key);
  }

  /** Outline of the current state: colour and the two widths. */
  function getOutline(palette, { dimmed, hovered, selected }) {
    if (selected) {
      return {
        color: tokens.selected.line,
        lineWidth: tokens.selected.lineWidth,
        casingWidth: tokens.selected.casingWidth,
      };
    }
    const color = dimmed ? tokens.dimmed.line : palette.line;
    if (hovered) return { color, ...tokens.hover };
    return dimmed
      ? { color, lineWidth: tokens.dimmed.lineWidth, casingWidth: tokens.dimmed.casingWidth }
      : { color, lineWidth: tokens.lineWidth, casingWidth: tokens.casingWidth };
  }

  function getFillOpacity({ hovered, imagery }) {
    const { fillOpacity } = tokens;
    if (hovered) return imagery ? fillOpacity.hoverImagery : fillOpacity.hover;
    return imagery ? fillOpacity.imagery : fillOpacity.base;
  }

  function createPolygonStyles(palette, colorKey, rank, flags) {
    const { dimmed, hovered, selected } = flags;
    const outline = getOutline(palette, flags);
    const fillColor = dimmed
      ? withOpacity(tokens.dimmed.fill, tokens.dimmed.fillOpacity)
      : withOpacity(palette.fill, getFillOpacity(flags));

    const styles = [new Style({ fill: new Fill({ color: fillColor }), zIndex: Z.fill + rank })];

    // A dimmed zone carries no hue at all, so it has no pattern either.
    const patternFill = dimmed ? null : getPatternFill(colorKey);
    if (patternFill) styles.push(new Style({ fill: patternFill, zIndex: Z.fill + rank }));

    // The outline of the hovered and of the selected zone is lifted above every
    // other outline. Its fill stays at the zone's own rank, so a zone nested
    // inside the selected one is still visible and clickable.
    const lifted = selected ? Z.selected : hovered ? Z.hover : null;
    styles.push(
      new Style({
        stroke: new Stroke({ color: tokens.casing, width: outline.casingWidth, lineJoin: 'round' }),
        zIndex: lifted ?? Z.casing + rank,
      }),
      new Style({
        stroke: new Stroke({ color: outline.color, width: outline.lineWidth, lineJoin: 'round' }),
        zIndex: lifted === null ? Z.line + rank : lifted + 1,
      }),
    );
    return styles;
  }

  function createMarkerStyles(palette, rank, flags) {
    const { dimmed, hovered, selected } = flags;
    const { marker } = tokens;

    let lineColor = dimmed ? tokens.dimmed.line : palette.line;
    let lineWidth = dimmed ? tokens.dimmed.lineWidth : marker.lineWidth;
    if (hovered) lineWidth = tokens.hover.lineWidth;
    if (selected) {
      lineColor = tokens.selected.line;
      lineWidth = tokens.selected.lineWidth;
    }
    // The casing is the same shape with a wider stroke: a ring of
    // marker.casingWidth stays visible outside the coloured line.
    const casingStroke = new Stroke({
      color: tokens.casing,
      width: lineWidth + 2 * marker.casingWidth,
      lineJoin: 'round',
    });
    const casingFill = new Fill({ color: tokens.casing });
    const fill = new Fill({ color: dimmed ? tokens.dimmed.fill : palette.fill });
    const stroke = new Stroke({ color: lineColor, width: lineWidth, lineJoin: 'round' });

    const zIndex = selected ? Z.markerSelected : hovered ? Z.markerHover : Z.marker + rank;
    return [
      new Style({
        geometry: labelGeometry,
        image: createMarkerImage(palette.marker, marker.radius, casingFill, casingStroke),
        zIndex,
      }),
      new Style({
        geometry: labelGeometry,
        image: createMarkerImage(palette.marker, marker.radius, fill, stroke),
        zIndex,
      }),
    ];
  }

  /**
   * Name of the zone at its labelPoint; a multi-style zone also gets the chip.
   * Chip and text are one style, so decluttering keeps or drops them together.
   */
  function createLabelStyle(feature, rank, flags) {
    const { marker, dimmed, hovered, selected } = flags;
    const { label } = tokens;
    const styleIds = feature.get('styleIds') ?? [];
    // The hovered and the selected zone always show their name; other labels give way.
    const declutterMode = hovered || selected ? 'obstacle' : 'declutter';

    const chip =
      !marker && !dimmed && styleIds.length > 1 ? getChip(styleIds, declutterMode) : null;

    // Below the marker or the chip, otherwise centred on the labelPoint.
    // A marker is an obstacle for labels, so its own label has to start clear
    // of it: outside the marker's pointer target plus the label's own padding.
    // Any closer and decluttering drops the label (checked for every shape).
    let offsetY = 0;
    if (marker) offsetY = tokens.marker.hitRadius + 2 * label.gap;
    else if (chip) offsetY = chip.height / 2 + label.gap;

    // Priority follows the draw and click order: the smaller zone wins.
    let zIndex = (dimmed ? Z.labelDimmed : Z.label) + rank;
    if (hovered) zIndex = Z.labelHover;
    if (selected) zIndex = Z.labelSelected;

    return new Style({
      geometry: labelGeometry,
      image: chip?.icon,
      text: new Text({
        text: feature.get('name'),
        font: labelFont,
        fill: new Fill({ color: dimmed ? label.colorDimmed : label.color }),
        stroke: new Stroke({ color: label.halo, width: label.haloWidth, lineJoin: 'round' }),
        textAlign: 'center',
        textBaseline: offsetY === 0 ? 'middle' : 'top',
        offsetY,
        padding: [label.gap, label.gap, label.gap, label.gap],
        declutterMode,
      }),
      zIndex,
    });
  }

  function style(feature, resolution) {
    const id = feature.getId();
    const styleIds = feature.get('styleIds') ?? [];
    const colorKey = state.colorKeyById?.get(id) ?? styleIds[0];
    const palette = tokens.styles[colorKey];

    if (!palette && import.meta.env?.DEV && !warned.has(id)) {
      warned.add(id);
      console.warn(`[zoneStyles] "${id}": no tokens for wine style "${colorKey}", drawn as dimmed.`);
    }

    const selected = id === state.selectedId;
    const hovered = id === state.hoveredId;
    const flags = {
      marker: isZoneMarker(feature, resolution, markerMaxSizePx),
      // A zone without a usable palette falls back to the hue-free look.
      dimmed: !palette || (state.matchingIds !== null && !state.matchingIds.has(id)),
      hovered,
      selected,
      imagery: state.imagery,
    };
    const showLabel =
      Boolean(feature.get('name')) &&
      (hovered || selected || resolution <= labelMaxResolution * (1 + RESOLUTION_EPSILON));

    const key = [
      id,
      colorKey,
      ...Object.values(flags).map(Number),
      Number(showLabel),
    ].join('|');

    let styles = cache.get(key);
    if (!styles) {
      const rank = feature.get('rank') ?? 0;
      // Without a palette the shape falls back to the circle and the dimmed colours.
      const safePalette = palette ?? { marker: 'circle', pattern: 'none' };
      styles = flags.marker
        ? createMarkerStyles(safePalette, rank, flags)
        : createPolygonStyles(safePalette, colorKey, rank, flags);
      if (showLabel) styles.push(createLabelStyle(feature, rank, flags));
      cache.set(key, styles);
    }
    return styles;
  }

  return {
    style,
    clearCache() {
      cache.clear();
    },
  };
}
