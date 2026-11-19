// src/map/layers/zonesLayer.js
import Feature from 'ol/Feature';
import { buffer, containsCoordinate, getHeight, getWidth } from 'ol/extent';
import MultiPolygon from 'ol/geom/MultiPolygon';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { createZoneStyle, getMarkerMaxSizePx, isZoneMarker } from '../styles/zoneStyles';

/**
 * Polygon coordinates of any geometry a zone may arrive as; everything else is
 * ignored. Coordinates, not Polygon objects: building a MultiPolygon from
 * Polygon objects shifts their ring offsets in place (OpenLayers 10), which
 * corrupts the loader's cached geometry on the second call.
 */
function toPolygonCoordinates(geometry) {
  switch (geometry?.getType()) {
    case 'Polygon':
      return [geometry.getCoordinates()];
    case 'MultiPolygon':
      return geometry.getCoordinates();
    case 'GeometryCollection':
      return geometry.getGeometriesArray().flatMap(toPolygonCoordinates);
    default:
      return [];
  }
}

/** Interior point of the largest part: the fallback when a zone has no usable labelPoint. */
function getFallbackLabelPoint(geometry) {
  const polygons = geometry.getPolygons();
  const largest = polygons.reduce((best, polygon) =>
    polygon.getArea() > best.getArea() ? polygon : best,
  );
  return largest.getInteriorPoint().getCoordinates().slice(0, 2);
}

function warn(message) {
  if (import.meta.env?.DEV) console.warn(`[zonesLayer] ${message}`);
}

/**
 * One feature per zone, always a MultiPolygon.
 *
 * - Features that share an id are merged, so a zone delivered in pieces is
 *   still selected and styled as one.
 * - A single-part zone written as Polygon (mapshaper does this) is wrapped.
 * - New Feature objects are created: the loader's cached features are never
 *   mutated, so calling this twice (StrictMode) gives the same result.
 *
 * Adds the derived properties the style function needs: labelGeometry, span, rank.
 *
 * @param {import('ol/Feature').default[]} features in the view projection, with
 *   `name`, `styleIds` and `labelPoint` ([x, y]) set by loaders/geometry.js
 * @returns {import('ol/Feature').default[]}
 */
function normalizeZoneFeatures(features) {
  const groups = new Map();
  features.forEach((feature) => {
    const id = feature.getId();
    if (id === undefined || id === null) {
      warn('a feature without an id was skipped.');
      return;
    }
    const group = groups.get(id) ?? { properties: null, polygons: [] };
    group.polygons.push(...toPolygonCoordinates(feature.getGeometry()));
    // Attributes come from the first piece that has them.
    if (!group.properties && feature.get('styleIds')) {
      group.properties = {
        name: feature.get('name'),
        styleIds: feature.get('styleIds'),
        labelPoint: feature.get('labelPoint'),
      };
    }
    groups.set(id, group);
  });

  const zones = [];
  groups.forEach(({ properties, polygons }, id) => {
    if (polygons.length === 0) {
      warn(`"${id}" has no polygon geometry and was skipped.`);
      return;
    }
    if (!properties) {
      warn(`"${id}" is not in the zones index (zones.json) and was skipped.`);
      return;
    }
    const geometry = new MultiPolygon(polygons);

    let labelPoint = properties.labelPoint;
    if (!labelPoint || !geometry.intersectsCoordinate(labelPoint)) {
      warn(`"${id}": labelPoint is missing or outside the zone; an interior point is used.`);
      labelPoint = getFallbackLabelPoint(geometry);
    }

    const extent = geometry.getExtent();
    const zone = new Feature({
      geometry,
      name: properties.name,
      styleIds: properties.styleIds,
      labelGeometry: new Point(labelPoint),
      span: Math.max(getWidth(extent), getHeight(extent)),
    });
    zone.setId(id);
    zones.push(zone);
  });

  // rank 0 = largest. The id breaks ties, so the order never depends on file order.
  zones
    .map((zone) => ({ zone, area: zone.getGeometry().getArea() }))
    .sort((a, b) => b.area - a.area || String(a.zone.getId()).localeCompare(String(b.zone.getId())))
    .forEach(({ zone }, rank) => zone.set('rank', rank, true));

  return zones;
}

/**
 * Wine zones layer, drawn above the regions layer.
 *
 * Owns the style state. Every change updates the state and calls
 * layer.changed(): the layer, its source and the features are never recreated.
 *
 * @param {object} zoneTokens mapTokens.zone
 * @param {object} options
 * @param {number} options.labelMaxResolution view resolution at LABEL_MIN_ZOOM
 */
export function createZonesLayer(zoneTokens, { labelMaxResolution }) {
  const state = {
    /** @type {Set<string>|null} null: no filter, every zone is active */
    matchingIds: null,
    /** @type {Map<string, string>} zone id → wine style slug that overrides the default colour */
    colorKeyById: new Map(),
    /** @type {string|null} */
    selectedId: null,
    /** @type {string|null} */
    hoveredId: null,
    imagery: false,
  };

  const markerMaxSizePx = getMarkerMaxSizePx(zoneTokens);
  const zoneStyle = createZoneStyle({ tokens: zoneTokens, state, labelMaxResolution });

  const source = new VectorSource();
  const layer = new VectorLayer({
    source,
    style: zoneStyle.style,
    // Labels (and the chip) give way to each other; markers are obstacles.
    declutter: true,
  });

  /** Updates one state key; redraws only when the value really changed. */
  function update(key, value) {
    if (state[key] === value) return false;
    state[key] = value;
    layer.changed();
    return true;
  }

  return {
    layer,

    /** @param {import('ol/Feature').default[]} features see normalizeZoneFeatures() */
    setFeatures(features) {
      source.clear(true);
      source.addFeatures(normalizeZoneFeatures(features));
      // Ranks may have changed, and cached styles carry the rank as z-index.
      zoneStyle.clearCache();
      layer.changed();
    },

    /**
     * Filter result. A zone that is not in `matchingIds` is dimmed: still
     * visible, still clickable. The filter logic itself lives outside the map.
     *
     * @param {object} appearance
     * @param {Set<string>|null} [appearance.matchingIds] null: no filter
     * @param {Map<string, string>} [appearance.colorKeyById] zone id → wine style slug
     */
    setAppearance({ matchingIds = null, colorKeyById } = {}) {
      state.matchingIds = matchingIds;
      state.colorKeyById = colorKeyById ?? new Map();
      layer.changed();
    },

    /**
     * The id may be set before the geometry has arrived (or name a zone that
     * has none): the style function applies it as soon as the feature exists.
     *
     * @param {string|null} id
     */
    setSelected(id) {
      return update('selectedId', id ?? null);
    },

    /** @param {string|null} id */
    setHovered(id) {
      return update('hoveredId', id ?? null);
    },

    /**
     * Fills are denser on satellite imagery ('hybrid' is imagery with labels).
     * @param {string} basemapId
     */
    setBasemap(basemapId) {
      return update('imagery', basemapId === 'imagery' || basemapId === 'hybrid');
    },

    /**
     * Zones under a map coordinate, best candidate first.
     *
     * Deterministic and independent of OpenLayers' own hit detection, so the
     * rule is the same on every device:
     *   1. a marker whose 24×24 px target contains the point (nearest centre first);
     *   2. zones whose area contains the point, smallest first: a zone nested in
     *      another one, or overlapping it, is always reachable;
     *   3. with a tolerance, the nearest zone boundary within reach.
     * Dimmed zones take part like any other zone.
     *
     * @param {import('ol/coordinate').Coordinate} coordinate in the view projection
     * @param {number} resolution current view resolution
     * @param {number} [tolerancePx] extra reach for imprecise pointers
     * @returns {string[]} zone ids
     */
    pickAt(coordinate, resolution, tolerancePx = 0) {
      const reach = tolerancePx * resolution;
      const markerReach = Math.max(zoneTokens.marker.hitRadius, tolerancePx) * resolution;
      const markers = [];
      const inside = [];
      const near = [];

      source.forEachFeature((feature) => {
        const candidate = { id: feature.getId(), rank: feature.get('rank') };

        if (isZoneMarker(feature, resolution, markerMaxSizePx)) {
          const [x, y] = feature.get('labelGeometry').getCoordinates();
          const distance = Math.hypot(x - coordinate[0], y - coordinate[1]);
          if (distance <= markerReach) markers.push({ ...candidate, distance });
          return;
        }

        const geometry = feature.getGeometry();
        if (!containsCoordinate(buffer(geometry.getExtent(), reach), coordinate)) return;
        if (geometry.intersectsCoordinate(coordinate)) {
          inside.push(candidate);
        } else if (reach > 0) {
          const [x, y] = geometry.getClosestPoint(coordinate);
          const distance = Math.hypot(x - coordinate[0], y - coordinate[1]);
          if (distance <= reach) near.push({ ...candidate, distance });
        }
      });

      // A higher rank is a smaller zone, and it is the one drawn on top.
      const smallestFirst = (a, b) => b.rank - a.rank;
      const nearestFirst = (a, b) => a.distance - b.distance || smallestFirst(a, b);
      return [
        ...markers.sort(nearestFirst),
        ...inside.sort(smallestFirst),
        ...near.sort(nearestFirst),
      ].map((candidate) => candidate.id);
    },
  };
}
