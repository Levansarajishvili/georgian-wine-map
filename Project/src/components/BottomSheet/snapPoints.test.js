// src/components/BottomSheet/snapPoints.test.js
import { describe, expect, it } from 'vitest';
import { FLICK_VELOCITY, nextSnap, pickSnap, stepSnap } from './snapPoints';

// A 640px-high phone: collapsed strip, half of the screen, full below the top bar.
const heights = { collapsed: 72, half: 320, full: 572 };

describe('nextSnap', () => {
  it('cycles collapsed → half → full → collapsed', () => {
    expect(nextSnap('collapsed')).toBe('half');
    expect(nextSnap('half')).toBe('full');
    expect(nextSnap('full')).toBe('collapsed');
  });
});

describe('stepSnap', () => {
  it('moves one state up or down', () => {
    expect(stepSnap('collapsed', 1)).toBe('half');
    expect(stepSnap('half', 1)).toBe('full');
    expect(stepSnap('full', -1)).toBe('half');
    expect(stepSnap('half', -1)).toBe('collapsed');
  });

  it('stays at the ends', () => {
    expect(stepSnap('full', 1)).toBe('full');
    expect(stepSnap('collapsed', -1)).toBe('collapsed');
  });
});

describe('pickSnap', () => {
  it('settles on the nearest state after a slow drag', () => {
    expect(pickSnap({ height: 100, velocity: 0, heights })).toBe('collapsed');
    expect(pickSnap({ height: 250, velocity: 0.1, heights })).toBe('half');
    expect(pickSnap({ height: 400, velocity: -0.1, heights })).toBe('half');
    expect(pickSnap({ height: 500, velocity: 0, heights })).toBe('full');
  });

  it('a flick upwards goes to the next state above, however short the drag', () => {
    expect(pickSnap({ height: 90, velocity: FLICK_VELOCITY, heights })).toBe('half');
    expect(pickSnap({ height: 330, velocity: 1, heights })).toBe('full');
  });

  it('a flick downwards goes to the next state below', () => {
    expect(pickSnap({ height: 560, velocity: -FLICK_VELOCITY, heights })).toBe('half');
    expect(pickSnap({ height: 310, velocity: -1, heights })).toBe('collapsed');
  });

  it('a flick past the last state stays there', () => {
    expect(pickSnap({ height: 572, velocity: 2, heights })).toBe('full');
    expect(pickSnap({ height: 72, velocity: -2, heights })).toBe('collapsed');
  });
});
