import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bounceYaw, edgeGlow, pickTarget, resolveCatch, steerInput, seabedY, WORLD_RADIUS, type Candidate } from '../src/logic';
import { SPECIES, dietLines } from '../src/species';
import { REGIONS } from '../src/regions';
import { Creature, spawnCreatures } from '../src/creatures';
import { Ecology } from '../src/ecology';

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

describe('flora and fauna', () => {
  it('has flora that sit on the sea floor and fauna that swim above it', () => {
    for (const sp of SPECIES) {
      const c = new Creature(0, sp);
      expect(c.flora).toBe(sp.kind === 'flora');
      if (c.flora) expect(c.position.y).toBeGreaterThan(seabedY(c.position.x, c.position.z));
    }
  });
  it('only lets things eat species that exist, and flora never eat', () => {
    const ids = new Set(SPECIES.map((s) => s.id));
    for (const sp of SPECIES) {
      for (const e of sp.eats ?? []) expect(ids.has(e)).toBe(true);
      if (sp.kind === 'flora') expect(sp.eats).toEqual([]);
    }
  });
  it('describes the food web in the info panel', () => {
    const lio = SPECIES.find((s) => s.id === 'liopleurodon')!;
    expect(dietLines(lio).join(' ')).toContain('Munches');
    expect(dietLines(SPECIES.find((s) => s.id === 'seaweed')!).join(' ')).toContain('Ammonite');
  });
});

describe('regions', () => {
  it('only name known species and flora, and spawn them', () => {
    const ids = new Set(SPECIES.map((s) => s.id));
    for (const r of REGIONS) {
      for (const id of [...Object.keys(r.fauna), ...Object.keys(r.flora)]) expect(ids.has(id)).toBe(true);
      expect(spawnCreatures(r).length).toBe(
        Object.values(r.fauna).reduce((a, b) => a + b, 0) + Object.values(r.flora).reduce((a, b) => a + b, 0),
      );
    }
  });
});

describe('boundary and catching', () => {
  it('glows only near the edge', () => {
    expect(edgeGlow(0)).toBe(0);
    expect(edgeGlow(WORLD_RADIUS - 30)).toBe(0);
    expect(edgeGlow(WORLD_RADIUS - 12)).toBeGreaterThan(0.3);
    expect(edgeGlow(WORLD_RADIUS)).toBe(1);
  });
  it('bounces off the wall back inwards', () => {
    // Heading straight out along +x at the east wall: comes straight back.
    expect(Math.cos(bounceYaw(0, WORLD_RADIUS, 0))).toBeCloseTo(-1);
    // A glancing blow keeps its sideways motion but turns inwards.
    const y = bounceYaw(-Math.PI / 4, WORLD_RADIUS, 0);
    expect(Math.cos(y)).toBeLessThan(0);
    expect(-Math.sin(y)).toBeCloseTo(Math.SQRT1_2);
    // Already heading in: unchanged.
    expect(bounceYaw(Math.PI, WORLD_RADIUS, 0)).toBe(Math.PI);
  });
  it('resolves catches by dice roll', () => {
    expect(resolveCatch(false, 0.2)).toBe('predator');
    expect(resolveCatch(false, 0.8)).toBe('escape');
    expect(resolveCatch(true, 0.1)).toBe('predator');
    expect(resolveCatch(true, 0.5)).toBe('prey');
    expect(resolveCatch(true, 0.9)).toBe('escape');
  });
});

describe('ecology', () => {
  afterEach(() => vi.restoreAllMocks());
  const sp = (id: string) => SPECIES.find((s) => s.id === id)!;
  const setup = (a: string, b: string) => {
    const hunter = new Creature(0, sp(a));
    const prey = new Creature(1, sp(b));
    hunter.position.set(0, -20, 0);
    prey.position.set(0.5, -20, 0);
    const camera = new THREE.PerspectiveCamera();
    camera.updateMatrixWorld();
    const calls: string[] = [];
    const fx = { pop: () => calls.push('pop'), burst: (_a: unknown, _n: number, k: string) => calls.push(k) };
    const sound = { gulp: () => calls.push('gulp'), pop: () => {}, voice: () => {} };
    const eco = new Ecology([hunter, prey], fx as never, sound as never, camera, new THREE.Object3D());
    return { hunter, prey, eco, calls };
  };

  it('gulps its prey, which pops and comes back somewhere else', () => {
    const { hunter, prey, eco, calls } = setup('peloneustes', 'belemnite');
    hunter.hunt(prey);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValue(0.5);
    eco.update(0.016);
    expect(calls).toContain('pop');
    expect(calls).toContain('gulp');
    expect(hunter.mood).toBe('chomp');
    expect(prey.position.distanceTo(hunter.position)).toBeGreaterThan(10);
  });
  it('lets prey escape', () => {
    const { hunter, prey, eco, calls } = setup('peloneustes', 'belemnite');
    hunter.hunt(prey);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValue(0.5);
    eco.update(0.016);
    expect(calls).not.toContain('pop');
    expect(prey.mood).toBe('flee');
    expect(hunter.mood).toBe('wander');
  });
  it('fights go either way', () => {
    const { hunter, prey, eco, calls } = setup('metriorhynchus', 'ophthalmosaurus');
    hunter.hunt(prey);
    prey.hunt(hunter);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValue(0.5);
    eco.update(0.016);
    expect(calls).toContain('pop');
    expect(prey.mood).toBe('chomp'); // the "prey" won this one
  });
  it('grazes: ammonite nibbles seaweed, which then grows back', () => {
    const { hunter: ammo, prey: weed, eco } = setup('ammonite', 'seaweed');
    ammo.graze(weed);
    eco.update(0.016);
    expect(ammo.mood).toBe('chomp');
    weed.update(0, 0);
    const small = weed.obj.scale.x;
    for (let t = 0; t < 30; t += 1) weed.update(1, t);
    expect(weed.obj.scale.x).toBeGreaterThan(small);
  });
  it('starts hunts for hungry predators', () => {
    const { hunter, prey, eco } = setup('peloneustes', 'belemnite');
    hunter.hunger = 0;
    prey.position.set(10, -20, 0);
    eco.update(0.6);
    expect(hunter.mood).toBe('hunt');
    expect(prey.mood).toBe('flee');
  });
});
