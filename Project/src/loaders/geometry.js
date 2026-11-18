// src/loaders/geometry.js
import GeoJSON from 'ol/format/GeoJSON';
import { createEmpty, extend } from 'ol/extent';
// `?url`: Vite emits the file as a hashed asset and returns its URL.
// Never import *.geo.json without it, that would put the geometry in the JS bundle.
import regionsUrl from '../data/regions.geo.json?url';

const format = new GeoJSON({
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857',
});

/** One request per file; a failed request is forgotten so the next call retries. */
const cache = new Map();

async function fetchGeometry(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[geometry] ${url}: HTTP ${response.status}`);
  }
  const features = format.readFeatures(await response.json());
  const extent = features.reduce(
    (result, feature) => extend(result, feature.getGeometry().getExtent()),
    createEmpty(),
  );
  return { features, extent };
}

function load(url) {
  if (!cache.has(url)) {
    const promise = fetchGeometry(url);
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  return cache.get(url);
}

/**
 * ADM1 regions, reprojected to EPSG:3857.
 * @returns {Promise<{ features: import('ol/Feature').default[], extent: import('ol/extent').Extent }>}
 */
export function loadRegionGeometry() {
  return load(regionsUrl);
}
