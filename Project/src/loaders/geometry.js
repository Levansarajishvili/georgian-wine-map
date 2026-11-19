// src/loaders/geometry.js
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import { createEmpty, extend } from 'ol/extent';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
// `?url`: Vite emits the file as a hashed asset and returns its URL.
// Never import *.geo.json without it, that would put the geometry in the JS bundle.
import regionsUrl from '../data/regions.geo.json?url';
import zonesUrl from '../data/zones.geo.json?url';
import { regions, stylesById, zonesById } from './catalogs';

const format = new GeoJSON({
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857',
});

/** One request per file; a failed request is forgotten so the next call retries. */
const cache = new Map();

async function fetchGeometry(url, decorate) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[geometry] ${url}: HTTP ${response.status}`);
  }
  const features = format.readFeatures(await response.json());
  decorate?.(features);
  const extent = features.reduce(
    (result, feature) => extend(result, feature.getGeometry().getExtent()),
    createEmpty(),
  );
  return { features, extent };
}

function load(url, decorate) {
  if (!cache.has(url)) {
    const promise = fetchGeometry(url, decorate);
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  return cache.get(url);
}

/**
 * Geometry files carry no attributes (02 §1), so what the zones layer draws
 * is joined here from the zones index by Feature.id:
 *   name        label text
 *   styleIds    wine style slugs sorted by styles.json `order`; the first one
 *               gives the zone its default colour (multi-style rule, context.md)
 *   labelPoint  [x, y] in EPSG:3857
 * A feature that is not in the index gets nothing and is skipped by the layer.
 */
function joinZoneIndex(features) {
  const order = (id) => stylesById.get(id)?.order ?? Number.MAX_SAFE_INTEGER;
  features.forEach((feature) => {
    const zone = zonesById.get(feature.getId());
    if (!zone) return;
    feature.setProperties(
      {
        name: zone.name.ka,
        styleIds: zone.styles.map((link) => link.id).sort((a, b) => order(a) - order(b)),
        labelPoint: fromLonLat(zone.labelPoint),
      },
      true,
    );
  });
}

/**
 * ADM1 regions, reprojected to EPSG:3857.
 * @returns {Promise<{ features: import('ol/Feature').default[], extent: import('ol/extent').Extent }>}
 */
export function loadRegionGeometry() {
  return load(regionsUrl);
}

/**
 * Wine zones, reprojected to EPSG:3857 and joined with the zones index.
 * @returns {Promise<{ features: import('ol/Feature').default[], extent: import('ol/extent').Extent }>}
 */
export function loadZoneGeometry() {
  return load(zonesUrl, joinZoneIndex);
}

/**
 * Administrative centres of the regions (regions.json `center`), as Point
 * features in EPSG:3857 for the pins of the map. Feature.id is the region's
 * id; `name` is the name of the town.
 *
 * Synchronous: the points are in the attribute file, not in a geometry file
 * (there is one point per region). A region without `center` gets no pin.
 * New features on every call, so each map instance owns the ones it was given.
 *
 * @returns {import('ol/Feature').default[]}
 */
export function createRegionCenterFeatures() {
  return regions
    .filter((region) => region.center)
    .map((region) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat(region.center.point)),
        name: region.center.name.ka,
      });
      feature.setId(region.id);
      return feature;
    });
}
