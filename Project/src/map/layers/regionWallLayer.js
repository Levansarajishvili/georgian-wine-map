// src/map/layers/regionWallLayer.js
import Layer from 'ol/layer/Layer';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Class of the layer's element; its look and the whole effect are in styles/global.css. */
const CONTAINER_CLASS = 'map-region-walls';
const WALL_CLASS = 'map-region-wall';
const RIM_CLASS = 'map-region-wall-rim';
const CAP_CLASS = 'map-region-wall-cap';
/** The wall is up while it has this class; without it the wall sinks. */
const RAISED_CLASS = 'is-raised';

/**
 * How far outside the map the outline is still drawn, CSS px. More than the
 * wall, its shadow and the line width together, so the cut is never seen.
 */
const CLIP_MARGIN_PX = 64;

/** Points closer than this to the last drawn one are skipped, CSS px. */
const MIN_STEP_PX = 0.75;

/** Removes a sunken wall even if `transitionend` never comes (hidden tab). */
const REMOVE_FALLBACK_MS = 1000;

/**
 * The part of a segment inside a box (Liang–Barsky), or null.
 * @returns {number[]|null} [x0, y0, x1, y1]
 */
function clipSegment(x0, y0, x1, y1, minX, minY, maxX, maxY) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, x0 - minX],
    [dx, maxX - x0],
    [-dy, y0 - minY],
    [dy, maxY - y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  // An end that was not cut is returned as it came in: the caller compares
  // it with the end of the previous segment to see whether the line goes on.
  return [
    t0 === 0 ? x0 : x0 + t0 * dx,
    t0 === 0 ? y0 : y0 + t0 * dy,
    t1 === 1 ? x1 : x0 + t1 * dx,
    t1 === 1 ? y1 : y0 + t1 * dy,
  ];
}

const round = (value) => Math.round(value * 10) / 10;

/**
 * SVG path of a region's outline in CSS px of the map, cut to the map (plus
 * a margin). The outline is only stroked, so the pieces need not be closed.
 *
 * @param {import('ol/geom/Polygon').default|import('ol/geom/MultiPolygon').default} geometry
 *   in the view projection
 * @param {number[]} transform frameState.coordinateToPixelTransform
 * @param {number[]} size [width, height] of the map, CSS px
 */
function createPathData(geometry, transform, size) {
  const flat = geometry.getFlatCoordinates();
  const stride = geometry.getStride();
  const ends = geometry.getType() === 'MultiPolygon' ? geometry.getEndss().flat() : geometry.getEnds();
  const [a, b, c, d, e, f] = transform;
  const minX = -CLIP_MARGIN_PX;
  const minY = -CLIP_MARGIN_PX;
  const maxX = size[0] + CLIP_MARGIN_PX;
  const maxY = size[1] + CLIP_MARGIN_PX;

  const parts = [];
  let offset = 0;
  for (const end of ends) {
    // End of the piece being written, or null when the next segment starts a new one.
    let penX = null;
    let penY = null;
    let fromX = a * flat[offset] + c * flat[offset + 1] + e;
    let fromY = b * flat[offset] + d * flat[offset + 1] + f;

    for (let i = offset + stride; i < end; i += stride) {
      const toX = a * flat[i] + c * flat[i + 1] + e;
      const toY = b * flat[i] + d * flat[i + 1] + f;
      const isLast = i + stride >= end;
      // Full OSM detail: at country zoom most points fall on the same pixel.
      if (!isLast && Math.abs(toX - fromX) + Math.abs(toY - fromY) < MIN_STEP_PX) continue;

      const clipped = clipSegment(fromX, fromY, toX, toY, minX, minY, maxX, maxY);
      if (clipped) {
        if (penX !== clipped[0] || penY !== clipped[1]) {
          parts.push(`M${round(clipped[0])} ${round(clipped[1])}`);
        }
        parts.push(`L${round(clipped[2])} ${round(clipped[3])}`);
        [, , penX, penY] = clipped;
      } else {
        penX = null;
        penY = null;
      }
      fromX = toX;
      fromY = toY;
    }
    offset = end;
  }
  return parts.join('');
}

/**
 * The wall of the hovered region: its outline rises from the map like a wall
 * and sinks back when the mouse leaves.
 *
 * The regions themselves are drawn on a canvas, and a canvas cannot be
 * animated with CSS. So this layer puts only the outline of the hovered
 * region into the DOM, as an SVG path in screen pixels, and adds or removes
 * one class. Everything that makes it a wall is CSS (styles/global.css): the
 * rise, the courses of the wall, its shadow, the duration.
 *
 * A layer, not an ol/Overlay: OpenLayers places its element between the
 * canvas of the regions and the canvas of the zones, so zones and pins stay
 * in front of the wall, and render() runs in the same frame as the canvases,
 * so the wall does not lag behind the map while it moves.
 *
 * A wall that is sinking stays in the DOM until its transition ends; hovering
 * the same region again raises it from where it is.
 */
export function createRegionWallLayer() {
  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;

  /**
   * Walls in the DOM: the raised one and those still sinking.
   * @type {Map<string, { element: HTMLElement, paths: SVGPathElement[], geometry: object, timer: number|undefined }>}
   */
  const walls = new Map();
  /** @type {string|null} */
  let raisedId = null;
  /** Transform and size of the last frame: a new wall is drawn before the next one. */
  let lastFrame = null;

  const draw = (wall) => {
    if (!lastFrame) return;
    const data = createPathData(wall.geometry, lastFrame.transform, lastFrame.size);
    wall.paths.forEach((path) => path.setAttribute('d', data));
  };

  const layer = new Layer({
    render(frameState) {
      const transform = frameState.coordinateToPixelTransform;
      const { size } = frameState;
      const moved =
        !lastFrame ||
        lastFrame.size[0] !== size[0] ||
        lastFrame.size[1] !== size[1] ||
        lastFrame.transform.some((value, index) => value !== transform[index]);
      if (moved) {
        lastFrame = { transform: transform.slice(), size: size.slice() };
        walls.forEach(draw);
      }
      return container;
    },
  });

  const remove = (id) => {
    const wall = walls.get(id);
    if (!wall) return;
    clearTimeout(wall.timer);
    wall.element.remove();
    walls.delete(id);
  };

  const createWall = (id, geometry) => {
    // The effect is on the div, the outline in the svg inside it: filter and
    // transform on an HTML box behave the same in every browser.
    const element = document.createElement('div');
    element.className = WALL_CLASS;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const paths = [RIM_CLASS, CAP_CLASS].map((className) => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', className);
      svg.append(path);
      return path;
    });

    // The wall has sunk: take it out. `transform` is the property that
    // carries the rise, so its end is the end of the movement.
    element.addEventListener('transitionend', (event) => {
      if (event.target === element && event.propertyName === 'transform' && raisedId !== id) {
        remove(id);
      }
    });

    const wall = { element, paths, geometry, timer: undefined };
    walls.set(id, wall);
    draw(wall);
    element.append(svg);
    container.append(element);
    return wall;
  };

  const sink = (id) => {
    const wall = walls.get(id);
    if (!wall) return;
    wall.element.classList.remove(RAISED_CLASS);
    clearTimeout(wall.timer);
    // The mouse only crossed the region: the wall has not been seen yet, so
    // no transition will run and none will end.
    if (getComputedStyle(wall.element).opacity === '0') {
      remove(id);
      return;
    }
    wall.timer = setTimeout(() => remove(id), REMOVE_FALLBACK_MS);
  };

  return {
    layer,

    /**
     * Raises the wall of a region and lets the previous one sink.
     *
     * @param {string|null} id region id, or null: no region is hovered
     * @param {object|null} [geometry] the region's geometry in the view
     *   projection; needed with an id
     */
    setRegion(id, geometry = null) {
      const next = id !== null && geometry ? id : null;
      if (next === raisedId) return;
      if (raisedId !== null) sink(raisedId);
      raisedId = next;
      if (next === null) return;

      const wall = walls.get(next) ?? createWall(next, geometry);
      clearTimeout(wall.timer);
      // A new wall starts flat: the browser has to see that state once,
      // otherwise there is nothing to animate from.
      void wall.element.offsetWidth;
      wall.element.classList.add(RAISED_CLASS);
      // The next frame redraws it with the frame's own transform.
      layer.changed();
    },

    /** Removes every wall at once: the regions were replaced, or the map is going. */
    clear() {
      raisedId = null;
      [...walls.keys()].forEach(remove);
    },
  };
}
