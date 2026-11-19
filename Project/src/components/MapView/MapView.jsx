// src/components/MapView/MapView.jsx
import { useContext, useEffect, useId, useRef, useState } from 'react';
import { ka } from '../../copy/ka';
import { getZoneMapTarget } from '../../domain/zoneMapTarget';
import { regionsById, zonesInListOrder } from '../../loaders/catalogs';
import {
  createRegionCenterFeatures,
  loadRegionGeometry,
  loadZoneGeometry,
} from '../../loaders/geometry';
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
 *
 * Keyboard (stage 8). The canvas has nothing a keyboard can reach inside it,
 * so the map container itself is one tab stop:
 *
 *   arrows, + and −       pan and zoom (OpenLayers' own keyboard interactions;
 *                         they listen on the focused container)
 *   Page Down / Page Up   next / previous zone, in the order of the region
 *                         list; the zone is highlighted, brought on screen if
 *                         it is not there, and announced (role="status")
 *   Enter                 opens that zone's panel (onOpenZone)
 *   Escape                removes the highlight
 *
 * role="application": a screen reader then passes these keys through instead
 * of using them for its own reading commands. The region list remains the
 * full equivalent for anyone who does not use the map at all (01 §1).
 *
 * @param {object} props
 * @param {(id: string) => void} [props.onOpenZone] Enter on a zone reached
 *   with the keyboard; the host opens the zone panel and moves the focus
 */
export default function MapView({ onOpenZone }) {
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

  // Zone the keyboard has stepped to; kept while the focus is elsewhere, so
  // Page Down continues from it when the focus comes back.
  const [cursorId, setCursorId] = useState(null);
  const [cursorStatus, setCursorStatus] = useState('');
  const helpId = useId();

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
    // Pins on the regional centres. The points are in regions.json, so there is
    // nothing to wait for; they appear with the first view (the regions' extent).
    controller.setFeatures({ regionCenters: createRegionCenterFeatures() });
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

  const moveCursor = (step) => {
    const controller = controllerRef.current;
    if (!controller) return;
    const total = zonesInListOrder.length;
    if (total === 0) {
      setCursorStatus(ka.map.keyboard.noZones);
      return;
    }

    const current = zonesInListOrder.findIndex((zone) => zone.id === cursorId);
    let index = (current + step + total) % total;
    if (current === -1) index = step > 0 ? 0 : total - 1;
    const zone = zonesInListOrder[index];

    setCursorId(zone.id);
    controller.setHighlightedZone(zone.id);
    // Moves the map only when the zone is not fully on screen; animated,
    // and without animation under prefers-reduced-motion (createMap). A zone
    // without an outline is shown by its region (getZoneMapTarget).
    const target = getZoneMapTarget(zone, regionsById);
    if (target) controller.revealBBox(target.bbox);

    const { matchingIds } = filterResult;
    const status = ka.map.keyboard.zone({
      name: zone.name.ka,
      regions: zone.regions
        .map((link) => regionsById.get(link.id)?.name.ka)
        .filter(Boolean)
        .join(', '),
      index: index + 1,
      total,
    });
    setCursorStatus(
      matchingIds !== null && !matchingIds.has(zone.id)
        ? `${status} ${ka.regionList.dimmed}.`
        : status,
    );
  };

  const handleKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      moveCursor(event.key === 'PageDown' ? 1 : -1);
    } else if (event.key === 'Enter' && cursorId) {
      event.preventDefault();
      onOpenZone?.(cursorId);
    } else if (event.key === 'Escape' && cursorId) {
      setCursorId(null);
      setCursorStatus('');
      controllerRef.current?.setHighlightedZone(null);
    }
  };

  // Coming back with the keyboard (Tab, or the zone panel closing) shows the
  // zone the keys will continue from. A mouse click on the map does not.
  const handleFocus = (event) => {
    if (cursorId && event.target.matches(':focus-visible')) {
      controllerRef.current?.setHighlightedZone(cursorId);
    }
  };

  const handleBlur = () => {
    controllerRef.current?.setHighlightedZone(null);
  };

  const hasError = regionsStatus === 'error' || zonesStatus === 'error';
  const isLoading = !hasError && (regionsStatus === 'loading' || zonesStatus === 'loading');

  return (
    <div className={styles.root}>
      {/* OpenLayers renders into this element and listens for keys on it. */}
      <div
        ref={targetRef}
        className={styles.canvas}
        tabIndex={0}
        role="application"
        aria-label={ka.map.keyboard.label}
        aria-describedby={helpId}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />

      <div ref={overlayRef} className={styles.overlay}>
        {/* Visible only while the map has keyboard focus (CSS); always the
            map's description for screen readers. */}
        <p id={helpId} className={styles.keyboardHelp}>
          {ka.map.keyboard.help}
        </p>
        {/* The highlight moves on the canvas only; this line says where it is. */}
        <p className={styles.visuallyHidden} role="status">
          {cursorStatus}
        </p>

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
