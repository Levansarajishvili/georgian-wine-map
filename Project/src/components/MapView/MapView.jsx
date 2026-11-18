// src/components/MapView/MapView.jsx
import { useContext, useEffect, useRef, useState } from 'react';
import { ka } from '../../copy/ka';
import { loadRegionGeometry, loadZoneGeometry } from '../../loaders/geometry';
import { DEFAULT_BASEMAP_ID } from '../../map/basemaps';
import { createMap } from '../../map/createMap';
import { useUrlFilters } from '../../state/useUrlFilters';
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
 *
 * Creates and destroys the map controller and puts it into the ref that
 * MapContext provides. The provider sits above MapView (in App), because the
 * region list and the zone panel live in the side panel, outside this
 * component, and need the same controller for "show on the map".
 * Without a provider the context's default ref is used and the map still works.
 *
 * The selected zone is owned by whoever renders the zone panel (App, through
 * useZoneSelection); MapView only connects the filter and the geometry.
 */
export default function MapView() {
  const targetRef = useRef(null);
  const overlayRef = useRef(null);
  const zoomRef = useRef(null);
  const attributionRef = useRef(null);
  const controllerRef = useContext(MapContext);

  // 'loading' | 'ready' | 'error', per geometry file.
  // Regions also define the initial view; zones are drawn on top when they arrive.
  const [regionsStatus, setRegionsStatus] = useState('loading');
  const [zonesStatus, setZonesStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  // Filter from the URL; `result` keeps its identity until the filter changes.
  const { result: filterResult } = useUrlFilters();

  // Create the map once. StrictMode runs mount → cleanup → mount in dev:
  // cleanup destroys the first instance, so only one map exists at a time.
  useEffect(() => {
    const controller = createMap({
      target: targetRef.current,
      zoomTarget: zoomRef.current,
      attributionTarget: attributionRef.current,
      labels: { zoomIn: ka.map.zoomIn, zoomOut: ka.map.zoomOut },
      basemapId: DEFAULT_BASEMAP_ID,
      // Default padding of every fit, read when the fit happens: the bottom
      // sheet changes --map-inset-bottom, and with it the overlay's padding.
      getFitPadding: () => (overlayRef.current ? readPadding(overlayRef.current) : [0, 0, 0, 0]),
    });
    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [controllerRef]);

  // Filter → zones layer. The layer keeps its features and only updates its
  // style state, then calls layer.changed(): zones outside `matchingIds` are
  // dimmed, matching zones take the colour of the selected style.
  // Declared after the map effect, so under StrictMode it runs again for the
  // second map instance. It does not wait for the geometry: the layer keeps
  // the state and applies it to features that arrive later.
  useEffect(() => {
    controllerRef.current?.setZoneAppearance({
      matchingIds: filterResult.matchingIds,
      colorKeyById: filterResult.colorKeyById,
    });
  }, [controllerRef, filterResult]);

  // Regions: add the features, then take the initial view from their extent.
  useEffect(() => {
    let cancelled = false;

    loadRegionGeometry()
      .then(({ features, extent }) => {
        const controller = controllerRef.current;
        if (cancelled || !controller) return;
        controller.setFeatures({ regions: features });
        controller.fitToExtent(extent, { animate: false });
        setRegionsStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setRegionsStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [controllerRef, attempt]);

  // Zones: independent of the regions, so one failed file does not hide the other.
  useEffect(() => {
    let cancelled = false;

    loadZoneGeometry()
      .then(({ features }) => {
        const controller = controllerRef.current;
        if (cancelled || !controller) return;
        controller.setFeatures({ zones: features });
        setZonesStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setZonesStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [controllerRef, attempt]);

  // A file that has loaded is served from the loader's cache on the next attempt.
  const handleRetry = () => {
    if (regionsStatus === 'error') setRegionsStatus('loading');
    if (zonesStatus === 'error') setZonesStatus('loading');
    setAttempt((count) => count + 1);
  };

  const hasError = regionsStatus === 'error' || zonesStatus === 'error';
  const isLoading = !hasError && (regionsStatus === 'loading' || zonesStatus === 'loading');

  return (
    <div className={styles.root}>
      <div ref={targetRef} className={styles.canvas} />

      <div ref={overlayRef} className={styles.overlay}>
        <div className={styles.controls}>
          <BasemapSwitcher />
          {/* OpenLayers renders the zoom buttons into this element. */}
          <div ref={zoomRef} />
        </div>

        <div className={styles.status} role="status">
          {isLoading && ka.map.loading}
          {hasError && (
            <>
              {regionsStatus === 'error' && <span>{ka.map.loadError}</span>}
              {zonesStatus === 'error' && <span>{ka.map.zonesLoadError}</span>}
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
  );
}
