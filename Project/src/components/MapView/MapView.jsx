// src/components/MapView/MapView.jsx
import { useEffect, useRef, useState } from 'react';
import { ka } from '../../copy/ka';
import { loadRegionGeometry } from '../../loaders/geometry';
import { DEFAULT_BASEMAP_ID } from '../../map/basemaps';
import { createMap } from '../../map/createMap';
import BasemapSwitcher from '../BasemapSwitcher/BasemapSwitcher';
import { MapContext } from './MapContext';
import styles from './MapView.module.css';

/**
 * The overlay's padding is the part of the map covered by edges and the
 * bottom sheet; the same numbers are used as fit padding: [top, right, bottom, left].
 */
function readPadding(element) {
  const computed = getComputedStyle(element);
  return ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map(
    (side) => parseFloat(computed[side]) || 0,
  );
}

/**
 * The only bridge between React and the map (map/createMap.js).
 * Owns the controller ref and provides it through MapContext.
 */
export default function MapView() {
  const targetRef = useRef(null);
  const overlayRef = useRef(null);
  const zoomRef = useRef(null);
  const attributionRef = useRef(null);
  const controllerRef = useRef(null);

  // 'loading' | 'ready' | 'error': regions geometry, which also defines the initial view
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  // Create the map once. StrictMode runs mount → cleanup → mount in dev:
  // cleanup destroys the first instance, so only one map exists at a time.
  useEffect(() => {
    const controller = createMap({
      target: targetRef.current,
      zoomTarget: zoomRef.current,
      attributionTarget: attributionRef.current,
      labels: { zoomIn: ka.map.zoomIn, zoomOut: ka.map.zoomOut },
      basemapId: DEFAULT_BASEMAP_ID,
    });
    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  // Regions: add the features, then take the initial view from their extent.
  useEffect(() => {
    let cancelled = false;

    loadRegionGeometry()
      .then(({ features, extent }) => {
        const controller = controllerRef.current;
        if (cancelled || !controller) return;
        controller.setFeatures({ regions: features });
        controller.fitToExtent(extent, {
          padding: readPadding(overlayRef.current),
          animate: false,
        });
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const handleRetry = () => {
    setStatus('loading');
    setAttempt((count) => count + 1);
  };

  return (
    <MapContext.Provider value={controllerRef}>
      <div className={styles.root}>
        <div ref={targetRef} className={styles.canvas} />

        <div ref={overlayRef} className={styles.overlay}>
          <div className={styles.controls}>
            <BasemapSwitcher />
            {/* OpenLayers renders the zoom buttons into this element. */}
            <div ref={zoomRef} />
          </div>

          <div className={styles.status} role="status">
            {status === 'loading' && ka.map.loading}
            {status === 'error' && (
              <>
                <span>{ka.map.loadError}</span>
                <button type="button" className={styles.retry} onClick={handleRetry}>
                  {ka.map.retry}
                </button>
              </>
            )}
          </div>

          {/* OpenLayers renders the attribution of the visible layers into this element. */}
          <div ref={attributionRef} className={styles.attribution} />
        </div>
      </div>
    </MapContext.Provider>
  );
}
