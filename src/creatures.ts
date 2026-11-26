import * as THREE from 'three';
import { SPECIES, type Anim, type Species } from './species';
import { WORLD_RADIUS, SURFACE_Y, seabedY } from './logic';
import type { Region } from './regions';

export type Mood = 'wander' | 'hello' | 'react' | 'flee' | 'hunt' | 'graze' | 'chomp';

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

/** An animal or a plant. Plants stay put, sway, and grow back after being nibbled. */
export class Creature {
  readonly obj = new THREE.Group();
  readonly model: THREE.Group;
  readonly radius: number;
  /** Max distance (world units) at which the portrait can appear. */
  readonly range: number;
  readonly flora: boolean;
  mood: Mood = 'wander';
  /** What this one is hunting or grazing. */
  target: Creature | null = null;
  /** Who is chasing this one right now. */
  threat: Creature | null = null;
  /** Seconds until it feels like hunting or grazing again. */
  hunger = 3 + Math.random() * 10;
  private anims: Anim[];
  private heading = Math.random() * Math.PI * 2;
  private pitch = 0;
  private targetHeading = this.heading;
  private targetY = 0;
  private nextTurn = 0;
  private moodT = 0;
  private bumpCooldown = 0;
  private shakeT = 0;
  private puffT = 0;
  private phase = Math.random() * 10;
  private baseScale: number;
  private halfH = 0;
  private regrow = 1;

  constructor(
    readonly id: number,
    readonly sp: Species,
  ) {
    this.model = sp.build();
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(tmp);
    this.baseScale = sp.length / size.x;
    this.flora = sp.kind === 'flora';
    if (this.flora) {
      // Centre the model on the group so picking and distances work from the middle of the plant.
      this.model.position.y = -(box.min.y + box.max.y) / 2;
      this.halfH = (size.y * this.baseScale) / 2;
      this.radius = Math.max(sp.length, size.y * this.baseScale) * 0.5;
    } else {
      this.radius = sp.length * 0.5;
    }
    this.obj.add(this.model);
    this.obj.scale.setScalar(this.baseScale);
    this.range = 12 + sp.length * 2.2;
    this.anims = collectAnims(this.model);
    this.moveTo(...this.randomSpot());
  }

  get position() {
    return this.obj.position;
  }

  private pickDepth(x: number, z: number) {
    const floor = seabedY(x, z) + this.radius * 0.8 + 2;
    const top = SURFACE_Y - this.radius * 0.6 - 2;
    return floor + Math.random() * Math.max(1, top - floor);
  }

  randomSpot(): [number, number] {
    const a = Math.random() * Math.PI * 2;
    const r = this.flora ? Math.sqrt(Math.random()) * (WORLD_RADIUS - 6) : 15 + Math.random() * (WORLD_RADIUS - 25);
    return [Math.cos(a) * r, Math.sin(a) * r];
  }

  /** (Re)start life at x, z: used at spawn and when something has been eaten and returns elsewhere. */
  moveTo(x: number, z: number) {
    this.target = this.threat = null;
    this.mood = 'wander';
    this.moodT = 0;
    this.regrow = 1;
    this.hunger = 6 + Math.random() * 10;
    this.obj.visible = true;
    this.heading = this.targetHeading = Math.random() * Math.PI * 2;
    this.pitch = 0;
    if (this.flora) {
      this.obj.position.set(x, seabedY(x, z) + this.halfH, z);
    } else {
      this.targetY = this.pickDepth(x, z);
      this.obj.position.set(x, this.targetY, z);
    }
  }

  private setMood(m: Mood, t = 0) {
    const eating = this.mood === 'hunt' || this.mood === 'graze' || this.mood === 'chomp';
    if (m === 'wander' && eating) this.hunger = 8 + Math.random() * 10;
    this.mood = m;
    this.moodT = t;
  }

  /** A friendly nudge from a tap, a bump, or being noticed. */
  trigger(kind: 'tap' | 'bump' | 'hello', from: THREE.Vector3) {
    if (kind === 'hello') {
      if (this.mood !== 'wander') return;
      this.setMood('hello', 0.9);
      return;
    }
    if (kind === 'bump') {
      if (this.bumpCooldown > 0) return;
      this.bumpCooldown = 4;
    }
    this.target = this.threat = null;
    this.setMood('react', this.flora ? 1 : 1.3);
    this.targetHeading = Math.atan2(-(this.position.z - from.z), this.position.x - from.x);
  }

  get reacting() {
    return this.mood === 'react';
  }

  hunt(prey: Creature) {
    this.target = prey;
    this.setMood('hunt', 14);
  }
  graze(plant: Creature) {
    this.target = plant;
    this.setMood('graze', 14);
  }
  scare(from: Creature) {
    if (this.mood === 'react' || this.mood === 'chomp') return;
    this.threat = from;
    this.target = null;
    this.setMood('flee', 3);
  }
  /** Nibbling a plant, or swallowing a catch (which puffs the tummy). */
  chomp(secs: number, gulp = false) {
    this.target = null;
    if (gulp) this.puffT = 0.6;
    this.setMood('chomp', secs);
  }
  /** Failed to catch: shake it off. */
  miss() {
    this.target = null;
    this.shakeT = 0.9;
    this.setMood('wander');
  }
  /** A plant has been nibbled and will grow back. */
  bite() {
    this.regrow = 0.55;
  }

  update(dt: number, t: number) {
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.hunger -= dt;
    this.moodT -= dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.puffT = Math.max(0, this.puffT - dt);
    if (this.flora) return this.updateFlora(dt, t);

    if (this.mood === 'react' && this.moodT <= 0) this.setMood('flee', 3.5);
    else if (this.mood !== 'wander' && this.moodT <= 0) this.setMood('wander');
    if ((this.mood === 'hunt' || this.mood === 'graze') && !this.target) this.setMood('wander');
    if (this.threat && this.threat.mood !== 'hunt') this.threat = null;

    const p = this.position;
    if (this.mood === 'wander' && t > this.nextTurn) {
      this.nextTurn = t + 3 + Math.random() * 4;
      this.targetHeading = this.heading + (Math.random() - 0.5) * 2.2;
      this.targetY = this.pickDepth(p.x, p.z);
    }
    const goal = this.mood === 'hunt' || this.mood === 'graze' ? this.target : null;
    if (goal) {
      this.targetHeading = Math.atan2(-(goal.position.z - p.z), goal.position.x - p.x);
      this.targetY = goal.position.y;
    } else if (this.mood === 'flee' && this.threat) {
      this.targetHeading = Math.atan2(-(p.z - this.threat.position.z), p.x - this.threat.position.x);
    }
    if (Math.hypot(p.x, p.z) > WORLD_RADIUS - 8 && this.mood !== 'react') {
      this.targetHeading = Math.atan2(p.z, p.x) + Math.PI + (Math.random() - 0.5) * 0.4;
    }

    // Steer.
    let dh = this.targetHeading - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const turnRate = this.mood === 'flee' ? 2.5 : this.mood === 'hunt' ? 1.8 : 0.8;
    this.heading += THREE.MathUtils.clamp(dh, -turnRate * dt, turnRate * dt);

    const speed = this.sp.speed * this.speedFactor();
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
    let scale = this.baseScale * (1 + Math.sin((this.puffT / 0.6) * Math.PI) * 0.25);
    if (this.mood === 'react') {
      const k = 1 - this.moodT / 1.3;
      this.model.rotation.x = k * Math.PI * 2;
      this.model.position.y += Math.sin(k * Math.PI) * 0.5;
      scale *= 1 + Math.sin(k * Math.PI) * 0.12;
    } else if (this.mood === 'hello') {
      this.model.rotation.x = Math.sin(t * 14) * 0.22 * (this.moodT / 0.9);
    } else if (this.mood === 'chomp' && this.puffT <= 0) {
      this.model.rotation.z = Math.sin(t * 12) * 0.15;
    }
    if (this.shakeT > 0) this.model.rotation.y = Math.sin(t * 30) * 0.3 * (this.shakeT / 0.9);
    this.obj.scale.setScalar(scale);

    const flapBoost = this.mood === 'flee' || this.mood === 'hunt' ? 1.8 : 1;
    for (const a of this.anims) {
      a.obj.rotation[a.axis] = a.base + Math.sin(t * a.speed * flapBoost + a.phase) * a.amp;
    }
  }

  private speedFactor() {
    switch (this.mood) {
      case 'flee':
        return this.threat ? 1.9 : 2.4;
      case 'hunt':
        return 1.7;
      case 'graze':
        return 0.8;
      case 'react':
        return 0.2;
      case 'chomp':
        return 0.05;
      default:
        return 1;
    }
  }

  private updateFlora(dt: number, t: number) {
    if (this.mood !== 'wander' && this.moodT <= 0) this.setMood('wander');
    this.regrow = Math.min(1, this.regrow + dt / 25);
    this.obj.scale.setScalar(this.baseScale * this.regrow);
    const p = this.position;
    p.y = seabedY(p.x, p.z) + this.halfH * this.regrow;
    if (!this.obj.visible) return;
    this.obj.rotation.z = this.mood === 'wander' ? 0 : Math.sin(t * 18) * 0.18 * Math.min(1, this.moodT);
    for (const a of this.anims) {
      a.obj.rotation[a.axis] = a.base + Math.sin(t * a.speed + a.phase) * a.amp;
    }
  }
}

export function spawnCreatures(region: Region): Creature[] {
  const list: Creature[] = [];
  for (const sp of SPECIES) {
    const n = (region.fauna[sp.id] ?? 0) + (region.flora[sp.id] ?? 0);
    for (let i = 0; i < n; i++) list.push(new Creature(list.length, sp));
  }
  return list;
}
