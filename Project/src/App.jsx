// src/App.jsx
import { useCallback, useEffect, useRef } from 'react';
import FilterPanel from './components/FilterPanel/FilterPanel';
import { MapContext } from './components/MapView/MapContext';
import MapView from './components/MapView/MapView';
import { useZoneSelection } from './components/MapView/useZoneSelection';
import RegionList from './components/RegionList/RegionList';
import ZonePanel from './components/ZonePanel/ZonePanel';
import { ka } from './copy/ka';
import styles from './App.module.css';

/**
 * Layout, and the container of the panel's content until the bottom sheet
 * exists (stage 8).
 *
 * Mobile: the map fills the screen and the panel is a collapsed bottom sheet.
 * Desktop and landscape phones: side panel on the left, map on the right.
 *
 * Panel content:
 *   no zone selected  → filter, then the region list
 *   a zone selected   → the zone panel replaces both (context.md, to be confirmed)
 *
 * The map controller ref is created here and provided through MapContext,
 * because the zone panel and the region list sit outside MapView and need
 * the same controller. MapView creates the controller and fills the ref.
 */
export default function App() {
  const controllerRef = useRef(null);
  const panelRef = useRef(null);
  const zoneHeadingRef = useRef(null);

  // Runs after MapView's effects (a child's effects come first), so the
  // controller already exists when the hook subscribes to map clicks.
  const { selectedId, select, clear } = useZoneSelection(controllerRef);

  // Opening the zone panel from the list removes the row that had the focus,
  // and closing the panel removes the close button. Without this the focus
  // would fall back to <body> (WCAG 2.4.3). A click on the map asks for
  // nothing: the pointer user is looking at the map, not at the panel.
  //   { panel: true }    → the zone panel's title
  //   { zoneId: '…' }    → that zone's row in the region list
  const focusRequestRef = useRef(null);

  useEffect(() => {
    const request = focusRequestRef.current;
    focusRequestRef.current = null;
    if (!request) return;
    if (request.panel) {
      zoneHeadingRef.current?.focus();
    } else {
      // Zone ids are slugs ([a-z0-9-], 02 §2): safe inside the selector.
      panelRef.current?.querySelector(`[data-zone-id="${request.zoneId}"]`)?.focus();
    }
  }, [selectedId]);

  const handleSelectFromList = useCallback(
    (id) => {
      focusRequestRef.current = { panel: true };
      select(id);
    },
    [select],
  );

  const handleCloseZone = useCallback(() => {
    focusRequestRef.current = { zoneId: selectedId };
    clear();
  }, [clear, selectedId]);

  return (
    <MapContext.Provider value={controllerRef}>
      <div className={styles.layout}>
        <aside ref={panelRef} className={styles.panel} aria-labelledby="app-title">
          <h1 id="app-title" className={styles.title}>
            {ka.app.title}
          </h1>
          {/* Hidden on mobile until the bottom sheet can open (stage 8): the
              collapsed sheet would clip the panel while its controls stayed
              focusable. A filter in the URL still applies to the map there. */}
          <div className={styles.panelBody}>
            {selectedId ? (
              <ZonePanel
                zoneId={selectedId}
                onClose={handleCloseZone}
                headingRef={zoneHeadingRef}
                headingLevel={2}
              />
            ) : (
              <>
                <FilterPanel headingLevel={2} />
                <RegionList
                  selectedZoneId={selectedId}
                  onSelectZone={handleSelectFromList}
                  headingLevel={2}
                />
              </>
            )}
          </div>
        </aside>

        <main className={styles.map} aria-label={ka.map.label}>
          <MapView />
        </main>
      </div>
    </MapContext.Provider>
  );
}
