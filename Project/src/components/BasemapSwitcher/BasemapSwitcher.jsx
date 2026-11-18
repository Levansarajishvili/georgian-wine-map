// src/components/BasemapSwitcher/BasemapSwitcher.jsx
import { useContext, useEffect, useId, useRef, useState } from 'react';
import { ka } from '../../copy/ka';
import { BASEMAPS, DEFAULT_BASEMAP_ID } from '../../map/basemaps';
import { MapContext } from '../MapView/MapContext';
import styles from './BasemapSwitcher.module.css';

/**
 * Button + popover with one radio per basemap from map/basemaps.js.
 * The choice is local state (not in the URL) and goes to the map through the
 * controller. The native Popover API gives Esc, light dismiss and focus return.
 */
export default function BasemapSwitcher() {
  const controllerRef = useContext(MapContext);
  const popoverRef = useRef(null);
  const popoverId = useId();
  const groupName = useId();
  const [activeId, setActiveId] = useState(DEFAULT_BASEMAP_ID);
  const [open, setOpen] = useState(false);

  // Keep aria-expanded in sync with the popover, whoever closes it.
  useEffect(() => {
    const popover = popoverRef.current;
    const handleToggle = (event) => setOpen(event.newState === 'open');
    popover.addEventListener('toggle', handleToggle);
    return () => popover.removeEventListener('toggle', handleToggle);
  }, []);

  const handleChange = (event) => {
    const id = event.target.value;
    setActiveId(id);
    controllerRef.current?.setBasemap(id);
  };

  return (
    <>
      <button
        type="button"
        className={`map-button ${styles.trigger}`}
        popoverTarget={popoverId}
        aria-label={ka.basemap.button}
        aria-expanded={open}
      >
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 4l8 4-8 4-8-4 8-4z" />
          <path d="M4 12l8 4 8-4" />
          <path d="M4 16l8 4 8-4" />
        </svg>
      </button>

      <div ref={popoverRef} id={popoverId} popover="auto" className={styles.popover}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{ka.basemap.button}</legend>
          {BASEMAPS.map((basemap) => (
            <label key={basemap.id} className={styles.option}>
              <input
                type="radio"
                name={groupName}
                value={basemap.id}
                checked={basemap.id === activeId}
                onChange={handleChange}
              />
              {ka.basemap.names[basemap.id]}
            </label>
          ))}
        </fieldset>
      </div>
    </>
  );
}
