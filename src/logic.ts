/** Pure game rules, kept free of three.js so they can be unit tested. */

export interface Candidate {
  id: number;
  /** Centre of the creature in normalised device coords (-1..1). */
  ndcX: number;
  ndcY: number;
  /** Distance in front of the camera; <= 0 means behind it. */
  depth: number;
  /** Straight-line distance from the sub. */
  dist: number;
  /** Max distance at which this creature can be identified. */
  range: number;
  /** Apparent half-height of the creature on screen, in NDC units. */
  apparent: number;
}

/** Radius of the "identify me" circle around screen centre, in half-heights. */
export const RETICLE = 0.34;
/** Once identified, a creature stays identified a little beyond the reticle. */
const STICKY = 1.3;

/**
 * Pick the creature to identify: on screen, in range, and nearest the screen
 * centre. The current target gets a wider tolerance so the card doesn't flicker.
 */
export function pickTarget(cands: Candidate[], aspect: number, current: number | null): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const c of cands) {
    if (c.depth <= 0 || Math.abs(c.ndcX) > 1.05 || Math.abs(c.ndcY) > 1.05) continue;
    const grow = c.id === current ? STICKY : 1;
    if (c.dist > c.range * grow) continue;
    const d = Math.hypot(c.ndcX * aspect, c.ndcY) - Math.min(c.apparent, 0.6) * 0.8;
    if (d > RETICLE * grow) continue;
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

/** Turn a touch position into yaw/pitch rates in -1..1, with a small dead zone. */
export function steerInput(px: number, py: number, w: number, h: number): { yaw: number; pitch: number } {
  const dz = (v: number) => (Math.abs(v) < 0.08 ? 0 : v - Math.sign(v) * 0.08);
  return {
    yaw: -dz((px - w / 2) / (w / 2)),
    pitch: -dz((py - h / 2) / (h / 2)),
  };
}

export const WORLD_RADIUS = 90;
export const SURFACE_Y = -4;

/** Gently rolling sea floor. */
export function seabedY(x: number, z: number): number {
  return -42 + 3 * Math.sin(x * 0.05) * Math.cos(z * 0.04) + 1.5 * Math.sin(x * 0.13 + z * 0.11);
}

export type CatchResult = 'predator' | 'prey' | 'escape';

/**
 * What happens when a hunter catches its target. `roll` is 0..1.
 * A fight (both species eat each other) can go either way; a plain chase is eat or escape.
 */
export function resolveCatch(mutual: boolean, roll: number): CatchResult {
  if (mutual) return roll < 1 / 3 ? 'predator' : roll < 2 / 3 ? 'prey' : 'escape';
  return roll < 0.5 ? 'predator' : 'escape';
}

/** How close the sub is to the edge of the zone: 0 well inside, 1 touching the wall. */
export function edgeGlow(r: number): number {
  const k = Math.min(1, Math.max(0, (r - (WORLD_RADIUS - 24)) / 24));
  return k * k * (3 - 2 * k);
}
