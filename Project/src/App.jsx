// src/App.jsx
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
        {/* Empty on purpose: search, filter, region list and zone panel come in later stages. */}
      </aside>

      <main className={styles.map} aria-label={ka.map.label}>
        <MapView />
      </main>
    </div>
  );
}
