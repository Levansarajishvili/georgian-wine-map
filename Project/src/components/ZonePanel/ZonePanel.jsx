// src/components/ZonePanel/ZonePanel.jsx
import { useContext, useEffect, useId, useRef, useState } from 'react';
import { ka } from '../../copy/ka';
import {
  grapesById,
  regionsById,
  sourcesById,
  stylesById,
  zonesById,
} from '../../loaders/catalogs';
import { useUrlFilters } from '../../state/useUrlFilters';
import { MapContext } from '../MapView/MapContext';
import StyleMarker from '../StyleMarker/StyleMarker';
import styles from './ZonePanel.module.css';

/** sources.json id of a record that has no data yet (02 §4.1). */
const PLACEHOLDER_SOURCE = 'placeholder';

/** zone.boundary.method of a boundary computed from village points (06 §5). */
const APPROXIMATE_METHOD = 'village-voronoi';

const collator = new Intl.Collator('ka');

/** How much of a list is unverified: 'none' | 'some' | 'all'. */
function unverifiedShare(records) {
  const count = records.filter((record) => !record.verified).length;
  if (count === 0) return 'none';
  return count === records.length ? 'all' : 'some';
}

/**
 * Where the "unverified" sign goes. It sits at the highest level it fully
 * covers, so a zone with nothing verified gets one notice instead of a sign
 * on every line:
 *
 *   panel    the zone record and every list are unverified → one notice on top
 *   section  a whole list is unverified                    → tag next to its heading
 *   item     part of a list is unverified                  → "?" next to those items
 *
 * 02 §6: the zone's own `verified` covers only "this zone exists and has this
 * name"; it does not sum up its lists. That sum is derived here.
 */
function getVerification(zone) {
  const share = {
    regions: unverifiedShare(zone.regions),
    styles: unverifiedShare(zone.styles),
    grapes: unverifiedShare(zone.grapes),
    villages: unverifiedShare(zone.villages),
  };
  const descriptionUnverified = zone.description ? !zone.description.verified : false;
  const panel =
    !zone.verified &&
    Object.values(share).every((value) => value === 'all') &&
    (!zone.description || descriptionUnverified);

  return {
    panel,
    zone: !panel && !zone.verified,
    description: !panel && descriptionUnverified,
    section: (key) => !panel && share[key] === 'all',
    item: (key, record) => !panel && share[key] === 'some' && !record.verified,
    // The regions line has no heading of its own, so it is always marked per item.
    region: (record) => !panel && !record.verified,
  };
}

/** One line about the zone's outline on the map, or null when it is verified. */
function getBoundaryNote(boundary) {
  if (!boundary || boundary.source === PLACEHOLDER_SOURCE) return ka.zone.boundary.missing;
  if (boundary.method === APPROXIMATE_METHOD) return ka.zone.boundary.approximate;
  return boundary.verified ? null : ka.zone.boundary.unverified;
}

/** Every source the panel's content comes from, the zone's own source first. */
function getSources(zone) {
  const ids = [
    zone.source,
    zone.description?.source,
    ...[zone.regions, zone.styles, zone.grapes, zone.villages].flat().map((link) => link.source),
    zone.boundary?.source,
  ];
  return [...new Set(ids)]
    .filter((id) => id && id !== PLACEHOLDER_SOURCE)
    .map((id) => sourcesById.get(id))
    .filter(Boolean);
}

/** A plain left click; anything else (new tab, new window, download) follows the href. */
const isPlainClick = (event) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function UnverifiedIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="-8 -8 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle r="6.75" />
      <path d="M-2 -2.3a2 2 0 1 1 3 1.75c-.7.4-1 .85-1 1.6M0 3.8v.1" />
    </svg>
  );
}

/** "?" next to one unverified item. Colour is not the sign: the shape and the hidden text are. */
function UnverifiedMark() {
  return (
    <span className={styles.mark}>
      <UnverifiedIcon className={styles.markIcon} />
      <span className={styles.visuallyHidden}> ({ka.zone.unverified.item})</span>
    </span>
  );
}

/** Tag next to a heading: the whole section is unverified. */
function UnverifiedTag() {
  return (
    <span className={styles.tag}>
      <UnverifiedIcon className={styles.markIcon} />
      {ka.zone.unverified.tag}
    </span>
  );
}

/**
 * Zone panel: what the selected wine zone is, in words a reader without wine
 * vocabulary understands (04-copy-voice.md).
 *
 * Container-independent on purpose, like FilterPanel: the root takes the
 * width it is given and has no position, height or scrolling of its own.
 * It goes into the desktop side panel now and into the mobile bottom sheet
 * later (stage 8). Opening, closing and focus on open belong to the
 * container: it passes `onClose` and may focus the title through `headingRef`.
 *
 * Reads: the filter from the URL (useUrlFilters) and the map controller
 * (MapContext). Shows nothing for an unknown zone id.
 *
 * @param {object} props
 * @param {string} props.zoneId zones.json id
 * @param {() => void} props.onClose
 * @param {{ current: HTMLElement|null }} [props.headingRef] the title; it has tabIndex -1
 * @param {2|3|4} [props.headingLevel] level of the zone name in the host's outline
 */
export default function ZonePanel({ zoneId, onClose, headingRef, headingLevel = 2 }) {
  const { filter, setOnly, hrefForOnly } = useUrlFilters();
  const controllerRef = useContext(MapContext);
  const rootRef = useRef(null);
  const baseId = useId();

  // Zone the map was last fitted to from this panel; drives the status line.
  const [shownZoneId, setShownZoneId] = useState(null);

  // A grape link turns into plain text once its filter is set, which would
  // drop the keyboard focus. This holds the id to focus after that render.
  const grapeToFocusRef = useRef(null);
  useEffect(() => {
    const id = grapeToFocusRef.current;
    if (!id) return;
    grapeToFocusRef.current = null;
    rootRef.current?.querySelector(`[data-grape-id="${id}"]`)?.focus();
  }, [filter]);

  const zone = zonesById.get(zoneId);
  if (!zone) return null;

  const Heading = `h${headingLevel}`;
  const SubHeading = `h${headingLevel + 1}`;
  const titleId = `${baseId}-title`;
  const boundaryNoteId = `${baseId}-boundary`;

  const verification = getVerification(zone);
  const boundaryNote = getBoundaryNote(zone.boundary);
  const sources = getSources(zone);
  const description = zone.description?.text?.ka;

  const regionLinks = zone.regions.filter((link) => regionsById.has(link.id));
  const styleLinks = zone.styles
    .filter((link) => stylesById.has(link.id))
    .sort((a, b) => stylesById.get(a.id).order - stylesById.get(b.id).order);
  const grapeLinks = zone.grapes
    .filter((link) => grapesById.has(link.id))
    .sort((a, b) =>
      collator.compare(grapesById.get(a.id).name.ka, grapesById.get(b.id).name.ka),
    );

  // "In the filter" for a grape means the link's own result is on the map:
  // this grape alone, no style (context.md: the link clears the style).
  const isOnlyGrape = (id) =>
    filter.style.length === 0 && filter.grape.length === 1 && filter.grape[0] === id;

  const hasItemMarks =
    regionLinks.some((link) => verification.region(link)) ||
    styleLinks.some((link) => verification.item('styles', link)) ||
    grapeLinks.some((link) => verification.item('grapes', link)) ||
    zone.villages.some((link) => verification.item('villages', link));

  const handleShowOnMap = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    // Animated; without animation under prefers-reduced-motion (createMap.fitToExtent).
    controller.fitToBBox(zone.bbox);
    setShownZoneId(zone.id);
  };

  const handleGrapeClick = (event, id) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    grapeToFocusRef.current = id;
    setOnly('grape', id);
  };

  return (
    <section ref={rootRef} className={styles.root} aria-labelledby={titleId}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <Heading id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
            {zone.name.ka}
          </Heading>
          {regionLinks.length > 0 && (
            <p className={styles.regions}>
              {regionLinks.map((link, index) => (
                <span key={link.id}>
                  {regionsById.get(link.id).name.ka}
                  {verification.region(link) && <UnverifiedMark />}
                  {index < regionLinks.length - 1 && ', '}
                </span>
              ))}
            </p>
          )}
          {verification.zone && <UnverifiedTag />}
        </div>
        <button type="button" className={styles.close} aria-label={ka.zone.close} onClick={onClose}>
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
      </div>

      {verification.panel && (
        <p className={styles.notice}>
          <UnverifiedIcon className={styles.noticeIcon} />
          <span>{ka.zone.unverified.all}</span>
        </p>
      )}

      {description ? (
        <p className={styles.description}>
          {description}
          {verification.description && <UnverifiedMark />}
        </p>
      ) : (
        <p className={styles.missing}>{ka.zone.missing.description}</p>
      )}

      <div className={styles.mapAction}>
        <button
          type="button"
          className={styles.button}
          aria-describedby={boundaryNote ? boundaryNoteId : undefined}
          onClick={handleShowOnMap}
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
            <circle cx="12" cy="12" r="6.5" />
            <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
          </svg>
          {ka.map.showOnMap}
        </button>
        {boundaryNote && (
          <p id={boundaryNoteId} className={styles.notice}>
            <UnverifiedIcon className={styles.noticeIcon} />
            <span>{boundaryNote}</span>
          </p>
        )}
        {/* The map moves without any change in the DOM; this line says it happened. */}
        <p className={styles.visuallyHidden} role="status">
          {shownZoneId === zone.id ? ka.map.shownOnMap(zone.name.ka) : ''}
        </p>
      </div>

      {styleLinks.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <SubHeading className={styles.sectionTitle}>{ka.zone.sections.style}</SubHeading>
            {verification.section('styles') && <UnverifiedTag />}
          </div>
          <ul className={styles.styleList}>
            {styleLinks.map((link) => {
              const inFilter = filter.style.includes(link.id);
              const note = ka.styleNotes[link.id];
              return (
                <li key={link.id} className={styles.styleItem}>
                  <span className={styles.badgeRow}>
                    <span
                      className={inFilter ? `${styles.badge} ${styles.badgeActive}` : styles.badge}
                    >
                      <StyleMarker styleId={link.id} />
                      {stylesById.get(link.id).name.ka}
                      {inFilter && (
                        <span className={styles.visuallyHidden}>, {ka.zone.inFilter}</span>
                      )}
                    </span>
                    {verification.item('styles', link) && <UnverifiedMark />}
                  </span>
                  {/* The style's name alone tells a newcomer little: one sentence under it. */}
                  {note && <p className={styles.note}>{note}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {grapeLinks.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <SubHeading className={styles.sectionTitle}>{ka.zone.sections.grape}</SubHeading>
            {verification.section('grapes') && <UnverifiedTag />}
          </div>
          <p className={styles.note}>
            {ka.terms.grape} {ka.zone.grapeHint}
          </p>
          <ul className={styles.grapeList}>
            {grapeLinks.map((link) => {
              const name = grapesById.get(link.id).name.ka;
              return (
                <li key={link.id} className={styles.grapeItem}>
                  {isOnlyGrape(link.id) ? (
                    // Not a link any more: its result is already on the map.
                    // Focusable from script only, to receive the focus the link had.
                    <span className={styles.grapeCurrent} tabIndex={-1} data-grape-id={link.id}>
                      <svg
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
                      {name}
                      <span className={styles.visuallyHidden}>, {ka.zone.inFilter}</span>
                    </span>
                  ) : (
                    <a
                      className={styles.grapeLink}
                      href={hrefForOnly('grape', link.id)}
                      onClick={(event) => handleGrapeClick(event, link.id)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="M4 5h16l-6 7v6l-4 2v-8L4 5z" />
                      </svg>
                      {name}
                    </a>
                  )}
                  {verification.item('grapes', link) && <UnverifiedMark />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {zone.villages.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <SubHeading className={styles.sectionTitle}>{ka.zone.sections.villages}</SubHeading>
            {verification.section('villages') && <UnverifiedTag />}
          </div>
          <ul className={styles.villages}>
            {zone.villages.map((village, index) => (
              <li key={village.id}>
                {village.name.ka}
                {verification.item('villages', village) && <UnverifiedMark />}
                {index < zone.villages.length - 1 && ', '}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.sources}>
        {sources.length === 0 ? (
          <p className={styles.missing}>{ka.zone.missing.source}</p>
        ) : (
          <>
            <p className={styles.sourcesLabel}>
              {sources.length === 1 ? ka.zone.source.one : ka.zone.source.many}:
            </p>
            <ul className={styles.sourceList}>
              {sources.map((source) => (
                <li key={source.id}>
                  {source.url ? (
                    <a
                      className={styles.sourceLink}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {source.title}
                      <span className={styles.visuallyHidden}>, {ka.zone.source.newTab}</span>
                    </a>
                  ) : (
                    source.title
                  )}
                  <span className={styles.sourceMeta}>
                    {[
                      source.publisher,
                      source.accessed && ka.zone.source.accessed(ka.date(source.accessed)),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {hasItemMarks && <p className={styles.legend}>{ka.zone.unverified.legend}</p>}
      </div>
    </section>
  );
}
