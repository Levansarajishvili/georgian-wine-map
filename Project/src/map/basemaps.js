// src/map/basemaps.js
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

/**
 * Basemap configuration: the only place where XYZ sources are defined.
 *
 * `url` and `attribution` are pasted verbatim: light as given from the
 * geohowtos.com XYZ list, terrain and imagery from leaflet-providers 4.0.0
 * (the list's own source; its {variant} placeholder is filled in).
 * Licences and usage conditions: docs/06-data-sources.md §8.
 * Never edit them to make a layer work: adapting a template to OpenLayers is
 * done by the optional fields below and by buildUrlOptions().
 *
 * id          'light' | 'terrain' | 'imagery' (label: copy/ka.js → basemap.names)
 * url         XYZ template exactly as listed
 * attribution attribution exactly as listed (may contain HTML links)
 * subdomains  only when the template has Leaflet's {s}: the subdomain letters, e.g. 'abc'.
 *             OpenLayers ranges such as {a-c} or {0-3} need nothing: they are expanded as is.
 * maxZoom     only when the list gives a provider limit; tiles are upscaled above it
 * key         only when the layer needs an API key:
 *             { placeholder: '<exact text in url to replace>', env: 'VITE_…' }
 *             The key ends up in the client bundle: restrict it to the site's domain.
 */
export const BASEMAPS = [
  {
    id: 'light',
    url: 'https://{a-c}.tile.openstreetmap.de/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: null,
    maxZoom: 18,
    key: null,
  },
  {
    id: 'terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    subdomains: 'abc',
    maxZoom: 17,
    key: null,
  },
  {
    id: 'imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    subdomains: null,
    maxZoom: null,
    key: null,
  },
];

export const DEFAULT_BASEMAP_ID = 'light';

function isConfigured(basemap) {
  return /^https?:\/\//.test(basemap.url);
}

/**
 * Turns a list-style template into XYZ source options.
 * OpenLayers expands ranges ({a-c}, {0-3}) itself, but only in the `url`
 * option, so a template without {s} is passed through as `url`.
 * {s} and {r} are Leaflet conventions: {s} becomes one URL per subdomain,
 * {r} (retina suffix) is dropped, so standard tiles are requested.
 */
function buildUrlOptions(basemap) {
  let template = basemap.url.replace('{r}', '');
  if (basemap.key) {
    const value = import.meta.env[basemap.key.env];
    if (!value && import.meta.env.DEV) {
      console.warn(`[basemaps] "${basemap.id}": ${basemap.key.env} is not set.`);
    }
    template = template.replace(basemap.key.placeholder, value ?? '');
  }
  if (!template.includes('{s}')) return { url: template };
  if (!basemap.subdomains) {
    throw new Error(`[basemaps] "${basemap.id}": url has {s} but "subdomains" is empty.`);
  }
  return {
    urls: [...basemap.subdomains].map((subdomain) => template.replace('{s}', subdomain)),
  };
}

function createSource(basemap) {
  if (!isConfigured(basemap)) {
    if (import.meta.env.DEV) {
      console.warn(`[basemaps] "${basemap.id}" has no XYZ url yet: fill it in src/map/basemaps.js.`);
    }
    return null;
  }
  return new XYZ({
    ...buildUrlOptions(basemap),
    attributions: basemap.attribution,
    ...(basemap.maxZoom ? { maxZoom: basemap.maxZoom } : {}),
  });
}

/**
 * Creates one tile layer per basemap; only the active one is visible, and a
 * hidden layer requests no tiles. Switching is layer.setVisible(), layers are
 * never recreated.
 *
 * @param {string} activeId
 * @returns {Map<string, import('ol/layer/Tile').default>}
 */
export function createBasemapLayers(activeId = DEFAULT_BASEMAP_ID) {
  return new Map(
    BASEMAPS.map((basemap) => [
      basemap.id,
      new TileLayer({
        source: createSource(basemap),
        visible: basemap.id === activeId,
        properties: { basemapId: basemap.id },
      }),
    ]),
  );
}
