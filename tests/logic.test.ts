import { describe, expect, it } from 'vitest';
import { pickTarget, steerInput, seabedY, type Candidate } from '../src/logic';
import { SPECIES } from '../src/species';
import { Creature } from '../src/creatures';

const base: Candidate = { id: 0, ndcX: 0, ndcY: 0, depth: 10, dist: 10, range: 20, apparent: 0.1 };

describe('pickTarget', () => {
  it('picks a creature at screen centre in range', () => {
    expect(pickTarget([base], 1.5, null)).toBe(0);
  });
  it('ignores creatures behind the camera, off screen, out of range or off-centre', () => {
    expect(pickTarget([{ ...base, depth: -5 }], 1.5, null)).toBeNull();
    expect(pickTarget([{ ...base, ndcX: 1.5 }], 1.5, null)).toBeNull();
    expect(pickTarget([{ ...base, dist: 30 }], 1.5, null)).toBeNull();
    expect(pickTarget([{ ...base, ndcX: 0.8 }], 1.5, null)).toBeNull();
  });
  it('prefers the one nearest the centre', () => {
    const a = { ...base, id: 1, ndcX: 0.15 };
    const b = { ...base, id: 2, ndcX: 0.05 };
    expect(pickTarget([a, b], 1.5, null)).toBe(2);
  });
  it('keeps the current target a little past the reticle', () => {
    const edge = { ...base, ndcX: 0.3 };
    expect(pickTarget([edge], 1.5, null)).toBeNull();
    expect(pickTarget([edge], 1.5, 0)).toBe(0);
  });
  it('lets a big creature count when its body covers the centre', () => {
    expect(pickTarget([{ ...base, ndcX: 0.45, apparent: 0.6 }], 1.5, null)).toBe(0);
  });
});

describe('steerInput', () => {
  it('is neutral at the centre and turns towards the finger', () => {
    expect(steerInput(500, 400, 1000, 800)).toEqual({ yaw: -0, pitch: -0 });
    expect(steerInput(1000, 400, 1000, 800).yaw).toBeLessThan(0);
    expect(steerInput(0, 400, 1000, 800).yaw).toBeGreaterThan(0);
    expect(steerInput(500, 0, 1000, 800).pitch).toBeGreaterThan(0);
  });
});

describe('world', () => {
  it('has a sea floor well below the surface', () => {
    for (let i = 0; i < 50; i++) expect(seabedY(i * 3, i * -2)).toBeLessThan(-35);
  });
});

describe('species', () => {
  it('has unique ids, facts and a model that builds', () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    for (const sp of SPECIES) {
      expect(sp.facts.length).toBeGreaterThanOrEqual(3);
      const c = new Creature(0, sp);
      c.update(0.05, 1);
      expect(c.obj.scale.x).toBeGreaterThan(0);
      expect(Number.isFinite(c.position.y)).toBe(true);
    }
  });
});
