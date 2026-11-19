// src/map/regionCenterPopup.js
import Overlay from 'ol/Overlay';

/** Class of the name plate; its look is in styles/global.css. */
const PLATE_CLASS = 'map-popup';

/** The two lines of the plate: the town, and below it the region. */
const NAME_CLASS = 'map-popup-name';
const REGION_CLASS = 'map-popup-region';

/** Starts the opening animation of the plate (global.css). */
const ENTERING_CLASS = 'map-popup-entering';

/** Free space kept around the plate when the map is moved to show it, CSS px. */
const PAN_MARGIN_PX = 12;

/**
 * Popup of a regional centre: a small plate above its pin with the name of
 * the town and, below it, the name of the region the town is the centre of.
 * One popup for the whole map: opening it for another centre moves it.
 *
 * It is a DOM element that OpenLayers keeps over the pin (ol/Overlay), not
 * something drawn on the canvas, so the text is real text. React does not
 * know about it: like hover, it starts and ends inside the map.
 *
 * @param {object} options
 * @param {object} options.tokens mapTokens.regionCenter: the plate sits
 *   `popupGap` above the top of the pin
 * @param {() => number} options.getPanDuration ms; read on every opening
 *   (0 under prefers-reduced-motion)
 */
export function createRegionCenterPopup({ tokens, getPanDuration }) {
  const plate = document.createElement('div');
  plate.className = PLATE_CLASS;
  const [nameLine, regionLine] = [NAME_CLASS, REGION_CLASS].map((className) => {
    const line = document.createElement('span');
    line.className = className;
    plate.append(line);
    return line;
  });

  const overlay = new Overlay({
    element: plate,
    // The bottom centre of the plate is `offset` above the tip of the pin.
    positioning: 'bottom-center',
    offset: [0, -(tokens.height + tokens.casingWidth + tokens.popupGap)],
    // A click on the plate is not a click on the map: it must not close the
    // popup or pick the zone behind it.
    stopEvent: true,
  });

  /** @type {string|null} id of the centre the popup is open for */
  let openId = null;

  function close() {
    if (openId === null) return;
    openId = null;
    overlay.setPosition(undefined);
  }

  return {
    /** Add to the map with map.addOverlay(). */
    overlay,

    /**
     * What a click on the map means for the popup:
     *   a pin              opens the popup there (and leaves any other pin);
     *   the pin it is on   closes it;
     *   anything else      (null) closes it.
     *
     * @param {{ id: string, name: string, regionName: string, coordinate: number[] }|null} center
     *   from regionCentersLayer.pickAt()
     */
    toggle(center) {
      if (!center || center.id === openId) {
        close();
        return;
      }
      openId = center.id;
      // Without the class the plate is in its final place: that is the box
      // panIntoView has to measure, not the one the animation starts from.
      plate.classList.remove(ENTERING_CLASS);
      nameLine.textContent = center.name;
      regionLine.textContent = center.regionName;
      overlay.setPosition(center.coordinate);
      // A pin near the edge: move the map just enough to show the whole plate.
      overlay.panIntoView({
        margin: PAN_MARGIN_PX,
        animation: { duration: getPanDuration() },
      });
      // The plate rises and fades in on every opening. Reading the layout
      // between removing and adding the class restarts the animation when
      // the popup only moves from one pin to another.
      void plate.offsetWidth;
      plate.classList.add(ENTERING_CLASS);
    },

    close,
  };
}
