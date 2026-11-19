// src/App.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import BottomSheet from './components/BottomSheet/BottomSheet';
import FilterPanel from './components/FilterPanel/FilterPanel';
import { MapContext } from './components/MapView/MapContext';
import MapView from './components/MapView/MapView';
import { useZoneSelection } from './components/MapView/useZoneSelection';
import RegionList from './components/RegionList/RegionList';
import ZonePanel from './components/ZonePanel/ZonePanel';
import { ka } from './copy/ka';
import { useIsDesktop } from './hooks/useMediaQuery';
import { regionsById, zonesById } from './loaders/catalogs';
import { useUrlFilters } from './state/useUrlFilters';
import styles from './App.module.css';

const PANEL_ID = 'app-panel';

/** Focuses the first element that exists and accepts the focus (not inert, not hidden). */
function focusFirst(candidates) {
  for (const element of candidates) {
    if (!element?.isConnected) continue;
    element.focus();
    if (document.activeElement === element) return;
  }
}

/**
 * Layout, and the host of the panel: which content it shows, how tall the
 * bottom sheet is, and where the keyboard focus goes.
 *
 * One container (BottomSheet), the same content components in both layouts:
 *
 *   desktop, landscape phone   side panel on the left, map on the right
 *     browse   filter, then the region list
 *     zone     the zone panel replaces both
 *
 *   mobile                     map on the whole screen, bottom sheet over it
 *     list     region list (default)
 *     filter   filter panel; opened by the filter button over the map
 *     zone     zone panel; a zone picked on the map, in the list or with the keyboard
 *
 * Bottom sheet height (mobile): the user sets it with the handle or by
 * dragging. Opening a panel (zone, filter) raises a collapsed sheet to half,
 * and closing that panel puts it back, unless the user has moved the sheet
 * in between.
 *
 * Focus (WCAG 2.4.3):
 *   - a panel opened from the DOM (list row, filter button, Enter on the
 *     map's keyboard cursor) takes the focus, on its title;
 *   - closing it returns the focus to the element that opened it. If that
 *     element is gone (on desktop the list is replaced by the zone panel and
 *     comes back as new elements), the zone's row in the list takes it, and
 *     as a last resort the panel itself;
 *   - a pointer click on the map moves no focus: that user is looking at the
 *     map, and its arrow keys should keep working.
 *
 * The map controller ref is created here and provided through MapContext,
 * because the panels sit outside MapView and need the same controller.
 * MapView creates the controller and fills the ref.
 */
export default function App() {
  const controllerRef = useRef(null);
  const sheetRef = useRef(null);
  const zoneHeadingRef = useRef(null);
  const filterHeadingRef = useRef(null);

  const isDesktop = useIsDesktop();
  const { filter, result } = useUrlFilters();

  // Runs after MapView's effects (a child's effects come first), so the
  // controller already exists when the hook subscribes to map clicks.
  const { selectedId, select, clear } = useZoneSelection(controllerRef);

  // Mobile only: the filter has replaced the region list in the sheet.
  const [filterOpen, setFilterOpen] = useState(false);

  let mode = 'list';
  if (selectedId) mode = 'zone';
  else if (isDesktop) mode = 'browse';
  else if (filterOpen) mode = 'filter';

  // ---------------------------------------------------------------
  // Bottom sheet height
  // ---------------------------------------------------------------
  // snap     current state
  // restore  state to return to when the open panel closes, or null
  // panel    the panel this state was computed for
  const [sheet, setSheet] = useState({ snap: 'collapsed', restore: null, panel: null });

  // A zone can be opened and closed by a click on the map, which never passes
  // through this component's handlers. So the sheet follows the panel by
  // comparing with the previous render (derived state, no effect).
  const panel = mode === 'zone' || mode === 'filter' ? mode : null;
  if (sheet.panel !== panel) {
    let { snap, restore } = sheet;
    if (panel && !sheet.panel) {
      // Opened: a collapsed sheet would hide the panel that was just asked for.
      restore = snap === 'collapsed' ? 'collapsed' : null;
      if (restore) snap = 'half';
    } else if (!panel && restore) {
      // Closed: back to how the user had it.
      snap = restore;
      restore = null;
    }
    setSheet({ snap, restore, panel });
  }

  // Handle or drag: from now on the height is the user's choice.
  const handleSnapChange = useCallback((snap) => {
    setSheet((current) => ({ ...current, snap, restore: null }));
  }, []);

  // "Show on the map" under a full-height sheet would move a map nobody can
  // see: the sheet steps down to half. The fit padding is the same for both
  // states (App.module.css), so the order of the two does not matter.
  const handleShowOnMap = useCallback(() => {
    if (isDesktop) return;
    setSheet((current) =>
      current.snap === 'full' ? { ...current, snap: 'half', restore: null } : current,
    );
  }, [isDesktop]);

  // ---------------------------------------------------------------
  // Filter result for screen readers
  // ---------------------------------------------------------------
  // One live region for the whole app (05 §6): it exists whatever the panel
  // shows, so a filter set from the zone panel (grape link) or from the URL
  // (back / forward) is announced too. Its first content is not announced;
  // every later change is. Two filters can give the same sentence ("1 ზონა
  // 2-დან" twice): the invisible no-break space alternates so the text still
  // changes and the confirmation is read again.
  const activeCount = filter.style.length + filter.grape.length;
  const summary = ka.filter.summaryOf({
    active: activeCount > 0,
    count: result.matchCount,
    total: result.totalCount,
  });
  const [live, setLive] = useState({ result, flip: false });
  if (live.result !== result) setLive({ result, flip: !live.flip });

  // ---------------------------------------------------------------
  // Focus
  // ---------------------------------------------------------------
  // Element that had the focus when each panel was opened from the DOM.
  const openersRef = useRef({ zone: null, filter: null });
  // () => elements to try, set by a handler and used after the next render.
  const focusRequestRef = useRef(null);

  useEffect(() => {
    const request = focusRequestRef.current;
    focusRequestRef.current = null;
    if (request) focusFirst(request());
  }, [selectedId, filterOpen]);

  // From the region list, or Enter on the map's keyboard cursor.
  const handleOpenZone = useCallback(
    (id) => {
      openersRef.current.zone = document.activeElement;
      if (id === selectedId) {
        // Already open (Enter on the map for the zone on show): nothing renders.
        zoneHeadingRef.current?.focus();
        return;
      }
      focusRequestRef.current = () => [zoneHeadingRef.current];
      select(id);
    },
    [select, selectedId],
  );

  const handleCloseZone = useCallback(() => {
    const opener = openersRef.current.zone;
    openersRef.current.zone = null;
    focusRequestRef.current = () => [
      opener,
      // Zone ids are slugs ([a-z0-9-], 02 §2): safe inside the selector.
      sheetRef.current?.querySelector(`[data-zone-id="${selectedId}"]`),
      sheetRef.current,
    ];
    clear();
  }, [clear, selectedId]);

  const handleCloseFilter = useCallback(() => {
    const opener = openersRef.current.filter;
    openersRef.current.filter = null;
    focusRequestRef.current = () => [opener, sheetRef.current];
    setFilterOpen(false);
  }, []);

  // Mobile: the button over the map. Pressing it again closes the filter;
  // the focus is on the button already, so nothing has to move.
  const handleFilterButton = () => {
    if (mode === 'filter') {
      setFilterOpen(false);
      return;
    }
    openersRef.current.filter = document.activeElement;
    focusRequestRef.current = () => [filterHeadingRef.current];
    // The user asked for the filter: an open zone gives way to it.
    if (selectedId) clear();
    setFilterOpen(true);
  };

  // Escape closes the open panel, like its close button.
  const handleSheetKeyDown = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // In a search field with text, Escape first clears the field (browser behaviour).
    if (event.target.matches?.('input[type="search"]') && event.target.value !== '') return;
    if (mode === 'zone') handleCloseZone();
    else if (mode === 'filter') handleCloseFilter();
  };

  // ---------------------------------------------------------------
  // The collapsed sheet's one line
  // ---------------------------------------------------------------
  const zone = mode === 'zone' ? zonesById.get(selectedId) : null;
  let peekTitle = ka.regionList.title;
  let peekNote = summary;
  if (zone) {
    peekTitle = zone.name.ka;
    peekNote = zone.regions
      .map((link) => regionsById.get(link.id)?.name.ka)
      .filter(Boolean)
      .join(', ');
  } else if (mode === 'filter') {
    peekTitle = ka.filter.title;
  }

  return (
    <MapContext.Provider value={controllerRef}>
      {/* data-sheet: the map keeps its controls above the sheet (--map-inset-bottom). */}
      <div className={styles.layout} data-sheet={sheet.snap}>
        {/* Mobile only (CSS). Outside <main>, so it stays usable while a
            full-height sheet covers the map and makes it inert. */}
        <div className={styles.topBar}>
          <button
            type="button"
            className={`map-button ${styles.filterButton}`}
            aria-label={ka.filter.button(activeCount)}
            aria-expanded={mode === 'filter'}
            aria-controls={PANEL_ID}
            onClick={handleFilterButton}
          >
            <svg
              className={styles.filterIcon}
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
            {/* The number is in the button's name ("ფილტრი, აქტიურია 2"). */}
            {activeCount > 0 && (
              <span className={styles.badge} aria-hidden="true">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        <BottomSheet
          rootRef={sheetRef}
          id={PANEL_ID}
          className={styles.panel}
          docked={isDesktop}
          snap={sheet.snap}
          onSnapChange={handleSnapChange}
          labelledBy="app-title"
          header={
            <h1 id="app-title" className={styles.title}>
              {ka.app.title}
            </h1>
          }
          peekTitle={peekTitle}
          peekNote={peekNote}
          scrollKey={`${mode}:${selectedId ?? ''}`}
          onKeyDown={handleSheetKeyDown}
        >
          {mode === 'zone' && (
            <ZonePanel
              zoneId={selectedId}
              onClose={handleCloseZone}
              onShowOnMap={handleShowOnMap}
              headingRef={zoneHeadingRef}
              headingLevel={2}
            />
          )}
          {(mode === 'browse' || mode === 'filter') && (
            <FilterPanel
              headingLevel={2}
              headingRef={filterHeadingRef}
              onClose={mode === 'filter' ? handleCloseFilter : undefined}
            />
          )}
          {(mode === 'browse' || mode === 'list') && (
            <RegionList
              selectedZoneId={selectedId}
              onSelectZone={handleOpenZone}
              onShowOnMap={handleShowOnMap}
              headingLevel={2}
            />
          )}
        </BottomSheet>

        {/* A full-height sheet covers the map and its controls: they leave the
            tab order, so the focus never lands on something that cannot be seen. */}
        <main
          className={styles.map}
          aria-label={ka.map.label}
          inert={!isDesktop && sheet.snap === 'full'}
        >
          <MapView onOpenZone={handleOpenZone} />
        </main>

        <p className={styles.visuallyHidden} role="status">
          {summary}
          {live.flip ? ' ' : ''}
        </p>
      </div>
    </MapContext.Provider>
  );
}
