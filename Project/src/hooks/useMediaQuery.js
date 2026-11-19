// src/hooks/useMediaQuery.js
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a media query matches, kept up to date.
 *
 * Only for behaviour that CSS cannot express (01 §3): which element is inert,
 * whether the sheet can be dragged, where the focus goes. Everything visual
 * stays in the stylesheets' own @media blocks.
 *
 * @param {string} query
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (listener) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', listener);
      return () => list.removeEventListener('change', listener);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  // No server rendering in this app; "mobile" is the safe value without a window.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * The layout's only breakpoint, as the CSS files write it:
 *
 *   @media (min-width: 48rem), (orientation: landscape) and (max-height: 30rem)
 *
 * The width comes from the --breakpoint-desktop token (03-tokens.css: "JS
 * reads this token"). The landscape-phone clause has no token; it is repeated
 * here exactly as in the stylesheets.
 */
let desktopQuery = null;

function getDesktopQuery() {
  if (!desktopQuery) {
    // tokens.css is imported before the first render (main.jsx).
    const width = getComputedStyle(document.documentElement)
      .getPropertyValue('--breakpoint-desktop')
      .trim();
    if (!width) {
      throw new Error('[useMediaQuery] --breakpoint-desktop is empty: is styles/tokens.css imported?');
    }
    desktopQuery = `(min-width: ${width}), (orientation: landscape) and (max-height: 30rem)`;
  }
  return desktopQuery;
}

/**
 * True where the panel is the side panel (desktop and landscape phones),
 * false where it is the bottom sheet.
 */
export function useIsDesktop() {
  return useMediaQuery(getDesktopQuery());
}
