import * as THREE from 'three';
import { SPECIES, type Anim, type Species } from './species';
import { WORLD_RADIUS, SURFACE_Y, seabedY } from './logic';

type Mood = 'wander' | 'hello' | 'react' | 'flee';

const tmp = new THREE.Vector3();

function collectAnims(root: THREE.Object3D): Anim[] {
  const out: Anim[] = [];
  root.traverse((o) => {
    for (const a of (o.userData.anims ?? []) as Omit<Anim, 'obj' | 'base'>[]) {
      out.push({ ...a, obj: o, base: o.rotation[a.axis] });
    }
  });
  return out;
}

export class Creature {
  readonly obj = new THREE.Group();
  readonly model: THREE.Group;
  readonly radius: number;
  /** Max distance (world units) at which the portrait can appear. */
  readonly range: number;
  private anims: Anim[];
  private heading = Math.random() * Math.PI * 2;
  private pitch = 0;
  private targetHeading = this.heading;
  private targetY: number;
  private nextTurn = 0;
  private mood: Mood = 'wander';
  private moodT = 0;
  private bumpCooldown = 0;
  private phase = Math.random() * 10;
  private baseScale: number;

  constructor(
    readonly id: number,
    readonly sp: Species,
  ) {
    this.model = sp.build();
    const size = new THREE.Box3().setFromObject(this.model).getSize(tmp);
    this.baseScale = sp.length / size.x;
    this.obj.add(this.model);
    this.obj.scale.setScalar(this.baseScale);
    this.radius = sp.length * 0.5;
    this.range = 12 + sp.length * 2.2;
    this.anims = collectAnims(this.model);

    const a = Math.random() * Math.PI * 2;
    const r = 15 + Math.random() * (WORLD_RADIUS - 25);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    this.targetY = this.pickDepth(x, z);
    this.obj.position.set(x, this.targetY, z);
  }

  get position() {
    return this.obj.position;
  }

  private pickDepth(x: number, z: number) {
    const floor = seabedY(x, z) + this.radius * 0.8 + 2;
    const top = SURFACE_Y - this.radius * 0.6 - 2;
    return floor + Math.random() * Math.max(1, top - floor);
  }

  /** A friendly nudge from a tap, a bump, or being noticed. */
  trigger(kind: 'tap' | 'bump' | 'hello', from: THREE.Vector3) {
    if (kind === 'hello') {
      if (this.mood !== 'wander') return;
      this.mood = 'hello';
      this.moodT = 0.9;
      return;
    }
    if (kind === 'bump') {
      if (this.bumpCooldown > 0) return;
      this.bumpCooldown = 4;
    }
    this.mood = 'react';
    this.moodT = 1.3;
    this.targetHeading = Math.atan2(-(this.position.z - from.z), this.position.x - from.x);
  }

  get reacting() {
    return this.mood === 'react';
  }

  update(dt: number, t: number) {
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.moodT -= dt;
    if (this.mood === 'react' && this.moodT <= 0) {
      this.mood = 'flee';
      this.moodT = 3.5;
    } else if (this.mood !== 'wander' && this.moodT <= 0) {
      this.mood = 'wander';
    }

    const p = this.position;
    if (this.mood === 'wander' && t > this.nextTurn) {
      this.nextTurn = t + 3 + Math.random() * 4;
      this.targetHeading = this.heading + (Math.random() - 0.5) * 2.2;
      this.targetY = this.pickDepth(p.x, p.z);
    }
    if (Math.hypot(p.x, p.z) > WORLD_RADIUS - 8 && this.mood !== 'react') {
      this.targetHeading = Math.atan2(p.z, p.x) + Math.PI + (Math.random() - 0.5) * 0.4;
    }

    // Steer.
    let dh = this.targetHeading - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const turnRate = this.mood === 'flee' ? 2.5 : 0.8;
    this.heading += THREE.MathUtils.clamp(dh, -turnRate * dt, turnRate * dt);

    const speed = this.sp.speed * (this.mood === 'flee' ? 2.4 : this.mood === 'react' ? 0.2 : 1);
    const wantPitch = THREE.MathUtils.clamp((this.targetY - p.y) * 0.08, -0.45, 0.45);
    this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 1.5);
    p.x += Math.cos(this.heading) * Math.cos(this.pitch) * speed * dt;
    p.z -= Math.sin(this.heading) * Math.cos(this.pitch) * speed * dt;
    p.y += Math.sin(this.pitch) * speed * dt;
    const floor = seabedY(p.x, p.z) + this.radius * 0.5 + 1;
    p.y = THREE.MathUtils.clamp(p.y, floor, SURFACE_Y - this.radius * 0.3);

    this.obj.rotation.set(0, this.heading, this.pitch);

    // Body language: gentle swim wobble, barrel roll when startled, wiggle when noticed.
    const swim = t * 3 + this.phase;
    this.model.rotation.set(0, 0, 0);
    this.model.position.set(0, Math.sin(swim * 0.5) * 0.08, 0);
    if (this.mood === 'react') {
      const k = 1 - this.moodT / 1.3;
      this.model.rotation.x = k * Math.PI * 2;
      this.model.position.y += Math.sin(k * Math.PI) * 0.5;
      this.obj.scale.setScalar(this.baseScale * (1 + Math.sin(k * Math.PI) * 0.12));
    } else {
      this.obj.scale.setScalar(this.baseScale);
      if (this.mood === 'hello') this.model.rotation.x = Math.sin(t * 14) * 0.22 * (this.moodT / 0.9);
    }

    const flapBoost = this.mood === 'flee' ? 1.8 : 1;
    for (const a of this.anims) {
      a.obj.rotation[a.axis] = a.base + Math.sin(t * a.speed * flapBoost + a.phase) * a.amp;
    }
  }
}

export function spawnCreatures(): Creature[] {
  const list: Creature[] = [];
  for (const sp of SPECIES) for (let i = 0; i < sp.count; i++) list.push(new Creature(list.length, sp));
  return list;
}
