// src/components/FilterPanel/FilterPanel.jsx
import { useId, useRef, useState } from 'react';
import { ka } from '../../copy/ka';
import { DIMENSIONS, getCatalogOptions, searchOptions } from '../../domain/filterLogic';
import { filterCatalog } from '../../loaders/catalogs';
import { useUrlFilters } from '../../state/useUrlFilters';
import styles from './FilterPanel.module.css';

/**
 * Marker shapes, same geometry as on the design canvas. Which style gets
 * which shape is NOT decided here: it is read from tokens.css
 * (--map-zone-<slug>-marker), the same token the map marker uses.
 */
const MARKER_SHAPES = {
  circle: <circle r="6" />,
  square: <rect x="-5.5" y="-5.5" width="11" height="11" />,
  triangle: <polygon points="0,-6 5.5,4.5 -5.5,4.5" />,
  diamond: <polygon points="0,-6 6,0 0,6 -6,0" />,
  star: (
    <polygon points="0,-7 1.88,-2.59 6.66,-2.16 3.04,0.99 4.11,5.66 0,3.2 -4.11,5.66 -3.04,0.99 -6.66,-2.16 -1.88,-2.59" />
  ),
};

/** style slug → marker shape name, from tokens.css. */
function readMarkerShapes(styleIds) {
  const computed = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    styleIds.map((id) => [
      id,
      computed.getPropertyValue(`--map-zone-${id}-marker`).trim() || 'circle',
    ]),
  );
}

/** The wine style's sign from the map: same shape, same colour tokens. */
function StyleMarker({ styleId, shape }) {
  return (
    <svg
      className={styles.marker}
      style={{
        '--marker-fill': `var(--map-zone-${styleId}-fill)`,
        '--marker-line': `var(--map-zone-${styleId}-line)`,
      }}
      viewBox="-8 -8 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {MARKER_SHAPES[shape] ?? MARKER_SHAPES.circle}
    </svg>
  );
}

/** Synonyms are mostly English; a screen reader should pronounce them as such. */
const langOf = (text) => (/^[\p{Script=Latin}\p{N}\s\p{P}]+$/u.test(text) ? 'en' : undefined);

/**
 * One filter option: a native checkbox drawn as a chip.
 *
 * A disabled option keeps `aria-disabled` instead of `disabled`: it stays in
 * the tab order, so a screen reader user reaches it and hears why it is off
 * (`aria-describedby` → the group's hint) instead of never finding it.
 */
function Chip({ option, describedBy, onToggle, children }) {
  return (
    <label className={styles.chip}>
      <input
        type="checkbox"
        className={styles.chipInput}
        checked={option.selected}
        aria-disabled={option.disabled || undefined}
        aria-describedby={describedBy || undefined}
        // A controlled checkbox: when nothing is written to the URL, React
        // puts the box back, so a disabled chip cannot be ticked.
        onChange={() => {
          if (!option.disabled) onToggle(option.id);
        }}
      />
      <span className={styles.chipBody}>
        <svg
          className={styles.check}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {children}
        <span>{option.label}</span>
        {/* The space is not drawn (flex), but keeps "name 2 ზონა" apart in the accessible name. */}{' '}
        <span className={styles.count}>
          {option.count}
          <span className={styles.visuallyHidden}> {ka.filter.zoneUnit}</span>
        </span>
      </span>
    </label>
  );
}

/**
 * Filter by wine style and grape: search field, chips with zone counts, result summary.
 *
 * Container-independent on purpose: the root takes the width it is given, has
 * no position, height or scrolling of its own, and wraps its chips. The same
 * component goes into the desktop side panel and into the mobile bottom
 * sheet (stage 8); scrolling belongs to the container. So do opening,
 * closing and the focus: the container passes `onClose` where the panel can
 * be closed (mobile) and may focus the title through `headingRef`.
 *
 * State: the filter itself is in the URL (useUrlFilters). The only local state
 * is the search text, which is not part of a shared link.
 *
 * The result line here is plain text. Its announcement to screen readers is
 * the app's live region (App.jsx): that one exists whatever panel is open,
 * and a second role="status" here would say every change twice.
 *
 * @param {object} props
 * @param {2|3|4} [props.headingLevel] level of the panel title in the host's outline
 * @param {{ current: HTMLElement|null }} [props.headingRef] the title; it has tabIndex -1
 * @param {() => void} [props.onClose] shows a close button when given
 */
export default function FilterPanel({ headingLevel = 2, headingRef, onClose }) {
  const { filter, result, toggle, clear } = useUrlFilters();
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const baseId = useId();

  // tokens.css is loaded before the first render (main.jsx), so one read is enough.
  const [markerShapes] = useState(() =>
    readMarkerShapes(getCatalogOptions(filterCatalog, 'style').map((style) => style.id)),
  );

  const Heading = `h${headingLevel}`;
  const titleId = `${baseId}-title`;
  const searchId = `${baseId}-search`;
  const hintId = (dimension, reason) => `${baseId}-hint-${dimension}-${reason}`;
  const matchId = (dimension, id) => `${baseId}-match-${dimension}-${id}`;

  const hasQuery = query.trim() !== '';
  const hasFilter = DIMENSIONS.some((dimension) => filter[dimension].length > 0);

  // Per group: options that match the search. A selected option stays visible
  // even when it does not match, so the active filter is never hidden.
  const groups = DIMENSIONS.map((dimension) => {
    const matches = new Map(
      searchOptions(getCatalogOptions(filterCatalog, dimension), query).map((match) => [
        match.id,
        match,
      ]),
    );
    const options = result.facets[dimension]
      .filter((option) => matches.has(option.id) || option.selected)
      .map((option) => ({
        ...option,
        matchedSynonym: matches.get(option.id)?.matchedSynonym ?? null,
      }));
    const reasons = [...new Set(options.map((option) => option.disabledReason).filter(Boolean))];
    return { dimension, options, reasons, matchCount: matches.size };
  });
  const foundCount = groups.reduce((sum, group) => sum + group.matchCount, 0);

  const synonymMatches = groups.flatMap(({ dimension, options }) =>
    options
      .filter((option) => option.matchedSynonym)
      .map((option) => ({ ...option, dimension })),
  );

  const summary = ka.filter.summaryOf({
    active: hasFilter,
    count: result.matchCount,
    total: result.totalCount,
  });

  let searchStatus = '';
  if (hasQuery) {
    searchStatus = foundCount === 0 ? ka.filter.search.nothing : ka.filter.search.found(foundCount);
  }

  const handleClearSearch = () => {
    setQuery('');
    searchRef.current?.focus();
  };

  return (
    <section className={styles.root} aria-labelledby={titleId}>
      <div className={styles.header}>
        <Heading id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
          {ka.filter.title}
        </Heading>
        <div className={styles.actions}>
          {/* aria-disabled, not disabled: after "clear" the focus stays on the button. */}
          <button
            type="button"
            className={styles.clear}
            aria-disabled={!hasFilter}
            onClick={() => {
              if (hasFilter) clear();
            }}
          >
            {ka.filter.clear}
          </button>
          {onClose && (
            <button
              type="button"
              className={styles.close}
              aria-label={ka.filter.close}
              onClick={onClose}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* What the filter did to the map, for the eye; announced by App's live region. */}
      <p className={styles.summary}>{summary}</p>

      <div className={styles.searchBlock}>
        <div className={styles.search}>
          <label className={styles.visuallyHidden} htmlFor={searchId}>
            {ka.filter.search.label}
          </label>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            ref={searchRef}
            id={searchId}
            className={styles.searchInput}
            type="search"
            value={query}
            placeholder={ka.filter.search.placeholder}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
          />
          {hasQuery && (
            <button
              type="button"
              className={styles.searchClear}
              aria-label={ka.filter.search.clear}
              onClick={handleClearSearch}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        {/* Always in the DOM so the change is announced; the visible text is below. */}
        <p className={styles.visuallyHidden} role="status">
          {searchStatus}
        </p>

        {hasQuery && foundCount === 0 && (
          <p className={styles.searchEmpty} aria-hidden="true">
            {ka.filter.search.nothing}
          </p>
        )}

        {synonymMatches.length > 0 && (
          <ul className={styles.matches}>
            {synonymMatches.map((option) => (
              <li key={`${option.dimension}-${option.id}`} id={matchId(option.dimension, option.id)}>
                {option.label} · {ka.filter.search.matchedBy}{' '}
                <span lang={langOf(option.matchedSynonym)}>{option.matchedSynonym}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {groups.map(
        ({ dimension, options, reasons }) =>
          options.length > 0 && (
            <fieldset key={dimension} className={styles.group}>
              <legend className={styles.legend}>{ka.filter.groups[dimension]}</legend>

              <div className={styles.chips}>
                {options.map((option) => {
                  const describedBy = [
                    option.matchedSynonym && matchId(dimension, option.id),
                    option.disabledReason && hintId(dimension, option.disabledReason),
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <Chip
                      key={option.id}
                      option={option}
                      describedBy={describedBy}
                      onToggle={(id) => toggle(dimension, id)}
                    >
                      {dimension === 'style' && (
                        <StyleMarker styleId={option.id} shape={markerShapes[option.id]} />
                      )}
                    </Chip>
                  );
                })}
              </div>

              {/* Visible to everyone, and the description of every disabled chip above. */}
              {reasons.map((reason) => (
                <p key={reason} id={hintId(dimension, reason)} className={styles.hint}>
                  {ka.filter.hints[dimension][reason]}
                </p>
              ))}
            </fieldset>
          ),
      )}
    </section>
  );
}
