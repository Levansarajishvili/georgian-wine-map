// src/components/BottomSheet/BottomSheet.jsx
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ka } from '../../copy/ka';
import { nextSnap, pickSnap, stepSnap } from './snapPoints';
import styles from './BottomSheet.module.css';

/**
 * Movement after which a press on the grip is a drag and no longer a tap.
 * CSS px; a behaviour threshold, not a design value (see snapPoints.js).
 */
const DRAG_THRESHOLD_PX = 6;

/** What the handle does when pressed, by the current state (05 §4.9, §7 №7). */
const HANDLE_LABELS = {
  collapsed: ka.sheet.expand,
  half: ka.sheet.expandFull,
  full: ka.sheet.collapse,
};

/** Fields that bring up the on-screen keyboard. */
const TEXT_FIELD = 'input:not([type="checkbox"], [type="radio"], [type="button"]), textarea';

/**
 * The three state heights in CSS px. They are tokens in rem and dvh, so they
 * are measured, not computed: a probe inside the sheet takes each in turn.
 */
function measureSnapHeights(sheet) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0';
  sheet.append(probe);
  const read = (name) => {
    probe.style.height = `var(--sheet-height-${name})`;
    return probe.getBoundingClientRect().height;
  };
  const heights = { collapsed: read('collapsed'), half: read('half'), full: read('full') };
  probe.remove();
  return heights;
}

/**
 * The panel's container: a bottom sheet on mobile, the side panel on desktop
 * and landscape phones. One <aside>, the same children in both; what differs
 * is CSS (BottomSheet.module.css) plus the behaviour switched by `docked`.
 *
 * Mobile states (05 §2.1), controlled by the host through `snap`:
 *   collapsed  handle + one line (`peekTitle`, `peekNote`); the content is
 *              hidden and inert, so nothing clipped stays focusable
 *   half       --sheet-height-half, the content scrolls inside
 *   full       up to --sheet-top-offset, the top bar stays visible
 *
 * The handle is a button: a press moves one state up and from the top back
 * down; ↑ and ↓ move one state without the detour. Its name says what the
 * press will do.
 *
 * Dragging, and why it never pans the map:
 *   - only the grip (handle + the collapsed line) starts a drag; the content
 *     below keeps its native scrolling;
 *   - the sheet is a sibling of the map, not a child of the OpenLayers
 *     viewport, so OpenLayers never sees a pointerdown that starts here and
 *     never begins a pan;
 *   - the pointer is captured on the grip when it goes down, so the moves
 *     keep coming to the grip while the finger or the mouse is over the map;
 *   - the grip has `touch-action: none`: the browser neither scrolls nor
 *     pulls-to-refresh under the drag.
 * The sheet follows the finger directly (no animation); the settle after the
 * release is a CSS transition with --motion-duration-sheet, which
 * prefers-reduced-motion turns off through the token.
 *
 * What the sheet does not know: which panel it shows, and where the focus
 * goes when a panel opens or closes. That belongs to the host (App).
 *
 * @param {object} props
 * @param {boolean} props.docked true: side panel (desktop); no states, no drag
 * @param {'collapsed'|'half'|'full'} props.snap
 * @param {(snap: 'collapsed'|'half'|'full') => void} props.onSnapChange
 * @param {string} [props.id] for aria-controls of a button that opens the sheet
 * @param {string} [props.className] placement in the host's layout
 * @param {string} props.labelledBy id of the element that names the <aside>
 * @param {React.ReactNode} [props.header] always available, above the content
 * @param {string} [props.peekTitle] collapsed line: what the sheet holds
 * @param {string} [props.peekNote] collapsed line: secondary text
 * @param {string} [props.scrollKey] the content scrolls back to the top when this changes
 * @param {{ current: HTMLElement|null }} [props.rootRef] the <aside>; it has tabIndex -1
 * @param {(event: React.KeyboardEvent) => void} [props.onKeyDown]
 * @param {React.ReactNode} props.children
 */
export default function BottomSheet({
  docked,
  snap,
  onSnapChange,
  id,
  className,
  labelledBy,
  header,
  peekTitle,
  peekNote,
  scrollKey,
  rootRef,
  onKeyDown,
  children,
}) {
  const ownRef = useRef(null);
  const sheetRef = rootRef ?? ownRef;
  const handleRef = useRef(null);
  const bodyRef = useRef(null);
  const bodyId = useId();

  const [dragging, setDragging] = useState(false);
  // The gesture in progress; mutated on every pointer move, never rendered.
  const dragRef = useRef(null);
  // A drag that ends over the grip is followed by a click: it must not also toggle.
  const suppressClickRef = useRef(false);

  // A new panel starts at its top. Mobile scrolls the body, desktop the <aside>.
  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (sheetRef.current) sheetRef.current.scrollTop = 0;
  }, [scrollKey, sheetRef]);

  const collapsed = !docked && snap === 'collapsed' && !dragging;

  const changeSnap = (next) => {
    if (next === snap) return;
    // Collapsing makes the content inert. If the focus is in there, it would
    // fall back to <body>: the handle takes it instead (WCAG 2.4.3).
    if (next === 'collapsed' && bodyRef.current?.contains(document.activeElement)) {
      handleRef.current?.focus();
    }
    onSnapChange?.(next);
  };

  // Keyboard, tap and screen reader activation all arrive here as a click.
  // The handler is on the grip, not on the button: with the pointer captured,
  // browsers send the click to the capturing element, and a tap on the
  // collapsed line counts too.
  const handleGripClick = () => {
    if (!docked) changeSnap(nextSnap(snap));
  };

  const handleGripClickCapture = (event) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleHandleKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    changeSnap(stepSnap(snap, event.key === 'ArrowUp' ? 1 : -1));
  };

  const handlePointerDown = (event) => {
    if (docked || (event.pointerType === 'mouse' && event.button !== 0)) return;
    // Captured from the first moment: a fast mouse leaves the 44px grip
    // between two move events, and an uncaptured move would go to the map.
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: sheetRef.current.getBoundingClientRect().height,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      height: 0,
      heights: null,
      active: false,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    // Screen y grows downwards; a positive delta makes the sheet taller.
    const delta = drag.startY - event.clientY;
    if (!drag.active) {
      if (Math.abs(delta) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
      drag.heights = measureSnapHeights(sheetRef.current);
      setDragging(true);
    }

    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = (drag.lastY - event.clientY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    drag.height = Math.min(
      Math.max(drag.startHeight + delta, drag.heights.collapsed),
      drag.heights.full,
    );
    // Straight to the DOM: one style write per move, no React render.
    sheetRef.current.style.setProperty('--sheet-drag-height', `${drag.height}px`);
  };

  const finishDrag = (event, cancelled) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    // Below the threshold it was a tap: the click that follows handles it.
    if (!drag.active) return;

    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    // Leaving the dragging state re-enables the height transition, so the
    // sheet settles from where the finger left it. A cancelled gesture
    // (incoming call, system gesture) goes back to where it started.
    setDragging(false);
    changeSnap(cancelled ? snap : pickSnap(drag));
  };

  // The on-screen keyboard covers the lower half of the screen: a text field
  // in a half-open sheet would end up under it, so the sheet opens fully.
  const handleBodyFocus = (event) => {
    if (!docked && snap !== 'full' && event.target.matches?.(TEXT_FIELD)) changeSnap('full');
  };

  return (
    <aside
      ref={sheetRef}
      id={id}
      className={className ? `${styles.sheet} ${className}` : styles.sheet}
      data-snap={snap}
      data-dragging={dragging || undefined}
      aria-labelledby={labelledBy}
      // Focusable from script only: the last resort when a closed panel has
      // nowhere better to return the focus to.
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {header && <div className={styles.header}>{header}</div>}

      {/* Mobile only (CSS). The button is the control; the pointer handlers on
          the wrapper add dragging and make the whole collapsed strip tappable. */}
      <div
        className={styles.grip}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishDrag(event, false)}
        onPointerCancel={(event) => finishDrag(event, true)}
        onClickCapture={handleGripClickCapture}
        onClick={handleGripClick}
      >
        <button
          ref={handleRef}
          type="button"
          className={styles.handle}
          aria-label={HANDLE_LABELS[snap]}
          aria-expanded={snap !== 'collapsed'}
          aria-controls={bodyId}
          onKeyDown={handleHandleKeyDown}
        >
          <span className={styles.handleBar} />
        </button>
        {peekTitle && (
          <p className={styles.peek}>
            <span className={styles.peekTitle}>{peekTitle}</span>
            {peekNote && <span className={styles.peekNote}>{peekNote}</span>}
          </p>
        )}
      </div>

      <div
        ref={bodyRef}
        id={bodyId}
        className={styles.body}
        inert={collapsed}
        onFocus={handleBodyFocus}
      >
        {children}
      </div>
    </aside>
  );
}
