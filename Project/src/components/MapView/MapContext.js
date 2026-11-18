// src/components/MapView/MapContext.js
import { createContext } from 'react';

/**
 * Holds a ref to the map controller (map/createMap.js). The ref object is
 * stable, so reading the context never causes a re-render. Call controller
 * methods only in event handlers and effects, never during render;
 * `current` is null until MapView has mounted.
 */
export const MapContext = createContext({ current: null });
