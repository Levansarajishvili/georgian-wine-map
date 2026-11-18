// src/App.jsx
import FilterPanel from './components/FilterPanel/FilterPanel';
import MapView from './components/MapView/MapView';
import { ka } from './copy/ka';
import styles from './App.module.css';

/**
 * Layout only: the panel area and the map.
 * Mobile: the map fills the screen and the panel is a collapsed bottom sheet.
 * Desktop and landscape phones: side panel on the left, map on the right.
 */
export default function App() {
  return (
    <div className={styles.layout}>
      <aside className={styles.panel} aria-labelledby="app-title">
        <h1 id="app-title" className={styles.title}>
          {ka.app.title}
        </h1>
        {/* Hidden on mobile until the bottom sheet can open (stage 8): the
            collapsed sheet would clip the panel while its controls stayed
            focusable. A filter in the URL still applies to the map there. */}
        <div className={styles.panelBody}>
          <FilterPanel headingLevel={2} />
        </div>
        {/* Region list and zone panel come in later stages. */}
      </aside>

      <main className={styles.map} aria-label={ka.map.label}>
        <MapView />
      </main>
    </div>
  );
}
