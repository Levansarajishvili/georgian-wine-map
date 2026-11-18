// src/components/StyleMarker/StyleMarker.jsx
import styles from './StyleMarker.module.css';

/**
 * Marker shapes, same geometry as on the design canvas and in FilterPanel.
 * Which style gets which shape is NOT decided here: it is read from
 * tokens.css (--map-zone-<slug>-marker), the same token the map marker uses.
 */
const SHAPES = {
  circle: <circle r="6" />,
  square: <rect x="-5.5" y="-5.5" width="11" height="11" />,
  triangle: <polygon points="0,-6 5.5,4.5 -5.5,4.5" />,
  diamond: <polygon points="0,-6 6,0 0,6 -6,0" />,
  star: (
    <polygon points="0,-7 1.88,-2.59 6.66,-2.16 3.04,0.99 4.11,5.66 0,3.2 -4.11,5.66 -3.04,0.99 -6.66,-2.16 -1.88,-2.59" />
  ),
};

/** style slug → shape name. tokens.css is loaded before the first render (main.jsx). */
const shapeBySlug = new Map();

function readShape(styleId) {
  if (!shapeBySlug.has(styleId)) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(`--map-zone-${styleId}-marker`)
      .trim();
    shapeBySlug.set(styleId, value in SHAPES ? value : 'circle');
  }
  return shapeBySlug.get(styleId);
}

/**
 * The wine style's sign from the map: same shape, same colour tokens
 * (05-ui-spec.md §4.7). Decorative: the style's name is always next to it,
 * or in the accessible name of whatever contains it.
 *
 * @param {object} props
 * @param {string} props.styleId styles.json slug
 * @param {boolean} [props.dimmed] grey, for a zone that does not match the filter
 */
export default function StyleMarker({ styleId, dimmed = false }) {
  return (
    <svg
      className={dimmed ? `${styles.marker} ${styles.dimmed}` : styles.marker}
      style={{
        '--marker-fill': `var(--map-zone-${styleId}-fill)`,
        '--marker-line': `var(--map-zone-${styleId}-line)`,
      }}
      viewBox="-8 -8 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[readShape(styleId)]}
    </svg>
  );
}
