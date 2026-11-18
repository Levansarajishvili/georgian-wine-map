// src/components/RegionList/RegionList.jsx
import { useContext, useId, useState } from 'react';
import { ka } from '../../copy/ka';
import { regions, stylesById, zonesByRegionId } from '../../loaders/catalogs';
import { useUrlFilters } from '../../state/useUrlFilters';
import { MapContext } from '../MapView/MapContext';
import StyleMarker from '../StyleMarker/StyleMarker';
import styles from './RegionList.module.css';

/** Wine styles of a zone in the order of the legend (styles.json `order`). */
function getZoneStyles(zone) {
  return zone.styles
    .map((link) => stylesById.get(link.id))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

/**
 * Regions and their wine zones as a list: the map's equivalent in the DOM
 * (01 §1, principle 5). It serves two readers: someone who cannot use the
 * canvas at all (keyboard, screen reader), and someone who can see the map
 * but does not know where Kakheti is.
 *
 *   region → fits the map to the region (animated; not under prefers-reduced-motion)
 *   zone   → onSelectZone(id): the host opens the zone panel
 *
 * A zone that the filter has dimmed on the map is dimmed here too, never
 * hidden, and can still be opened (context.md). A zone that crosses two
 * regions is listed under both (02 §4.5).
 *
 * Container-independent, like FilterPanel: no width, height, position or
 * scrolling on the root.
 *
 * Zone rows are buttons, not links: the selected zone is not in the URL yet
 * (01 §5, `zone=` is still a proposal), and a link must lead somewhere that
 * survives a reload. Each row carries data-zone-id, so the host can return
 * the focus to it when the zone panel closes.
 *
 * @param {object} props
 * @param {string|null} [props.selectedZoneId]
 * @param {(id: string) => void} [props.onSelectZone]
 * @param {2|3|4} [props.headingLevel] level of the list title in the host's outline
 */
export default function RegionList({ selectedZoneId = null, onSelectZone, headingLevel = 2 }) {
  const { result } = useUrlFilters();
  const controllerRef = useContext(MapContext);
  const baseId = useId();

  // Region the map was last fitted to from this list; drives the status line.
  const [shownRegion, setShownRegion] = useState(null);

  const Heading = `h${headingLevel}`;
  const SubHeading = `h${headingLevel + 1}`;
  const titleId = `${baseId}-title`;

  // null: no filter, nothing is dimmed.
  const { matchingIds } = result;

  const handleShowRegion = (region) => {
    const controller = controllerRef.current;
    if (!controller) return;
    // Animated; without animation under prefers-reduced-motion (createMap.fitToExtent).
    controller.fitToBBox(region.bbox);
    setShownRegion(region);
  };

  return (
    <section className={styles.root} aria-labelledby={titleId}>
      <div className={styles.header}>
        <Heading id={titleId} className={styles.title}>
          {ka.regionList.title}
        </Heading>
        <p className={styles.intro}>{ka.regionList.intro}</p>
        {/* The map moves without any change in the DOM; this line says it happened. */}
        <p className={styles.visuallyHidden} role="status">
          {shownRegion ? ka.map.shownOnMap(shownRegion.name.ka) : ''}
        </p>
      </div>

      <ul className={styles.regions}>
        {regions.map((region) => {
          const regionZones = zonesByRegionId.get(region.id) ?? [];

          return (
            <li key={region.id} className={styles.region}>
              <SubHeading className={styles.regionHeading}>
                <button
                  type="button"
                  className={styles.regionButton}
                  onClick={() => handleShowRegion(region)}
                >
                  <span className={styles.regionLabel}>
                    {region.name.ka}
                    <span className={styles.regionCount}>
                      {' · '}
                      {ka.regionList.zoneCount(regionZones.length)}
                    </span>
                    <span className={styles.visuallyHidden}>, {ka.map.showOnMap}</span>
                  </span>
                  <svg
                    className={styles.regionIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="12" cy="12" r="6.5" />
                    <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
                  </svg>
                </button>
              </SubHeading>

              {regionZones.length === 0 ? (
                <p className={styles.empty}>{ka.regionList.empty}</p>
              ) : (
                <ul className={styles.zones}>
                  {regionZones.map((zone) => {
                    const dimmed = matchingIds !== null && !matchingIds.has(zone.id);
                    const zoneStyles = getZoneStyles(zone);

                    return (
                      <li key={zone.id}>
                        <button
                          type="button"
                          className={dimmed ? `${styles.zone} ${styles.zoneDimmed}` : styles.zone}
                          aria-current={zone.id === selectedZoneId ? 'true' : undefined}
                          data-zone-id={zone.id}
                          onClick={() => onSelectZone?.(zone.id)}
                        >
                          <span className={styles.zoneText}>
                            <span>{zone.name.ka}</span>
                            {/* Text, not colour alone, says why the row is grey. */}
                            {dimmed && (
                              <span className={styles.zoneNote}>
                                <span className={styles.visuallyHidden}>, </span>
                                {ka.regionList.dimmed}
                              </span>
                            )}
                          </span>
                          <span className={styles.zoneStyles}>
                            {zoneStyles.map((style) => (
                              <StyleMarker key={style.id} styleId={style.id} dimmed={dimmed} />
                            ))}
                            {/* The signs are decorative; their meaning in words. */}
                            <span className={styles.visuallyHidden}>
                              , {zoneStyles.map((style) => style.name.ka).join(', ')}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
