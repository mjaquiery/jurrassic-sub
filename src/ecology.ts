import * as THREE from 'three';
import type { Sound } from './audio';
import type { Creature } from './creatures';
import type { Fx } from './fx';
import { resolveCatch } from './logic';

const frustum = new THREE.Frustum();
const m = new THREE.Matrix4();
const ball = new THREE.Sphere();
const tmp = new THREE.Vector3();

/** How far an animal notices food or prey: three body lengths, so nothing hunts from across the map. */
const sense = (a: Creature) => Math.max(6, a.sp.length * 3);
const reach = (a: Creature, b: Creature) => a.radius * 0.6 + b.radius * 0.4 + 0.6;
const eats = (a: Creature, b: Creature) => a.sp.eats?.includes(b.sp.id) ?? false;

/**
 * The food web in action: hungry animals chase prey or graze on plants, prey runs,
 * and a catch is either a (cartoon) gulp or a lucky escape. Whatever is eaten pops
 * and comes back somewhere off-camera, so numbers stay the same.
 */
export class Ecology {
  private scanT = 0;

  constructor(
    private things: Creature[],
    private fx: Fx,
    private sound: Sound,
    private camera: THREE.Camera,
    private ear: THREE.Object3D,
  ) {}

  update(dt: number) {
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.5;
      this.scan();
    }
    for (const a of this.things) {
      const b = a.target;
      if (!b || (a.mood !== 'hunt' && a.mood !== 'graze')) continue;
      if (a.position.distanceTo(b.position) > reach(a, b)) continue;
      if (a.mood === 'graze') this.nibble(a, b);
      else this.catch(a, b);
    }
  }

  private scan() {
    for (const a of this.things) {
      if (a.flora) continue;
      if (a.mood === 'hunt' || a.mood === 'graze') {
        const b = a.target;
        if (!b || a.position.distanceTo(b.position) > sense(a) * 1.8) a.target = null;
        else if (a.mood === 'hunt' && !b.flora && !eats(b, a)) b.scare(a);
        continue;
      }
      if (a.mood !== 'wander' || a.hunger > 0) continue;
      let best: Creature | null = null;
      let bestD = sense(a);
      for (const b of this.things) {
        if (b === a || !eats(a, b)) continue;
        const d = a.position.distanceTo(b.position) - b.radius;
        if (d < bestD) [best, bestD] = [b, d];
      }
      if (!best) continue;
      if (best.flora) {
        a.graze(best);
        continue;
      }
      a.hunt(best);
      // Prey runs, unless it eats the hunter too: then it's a fight.
      if (eats(best, a)) {
        if (best.mood === 'wander' || best.mood === 'flee') best.hunt(a);
      } else best.scare(a);
    }
  }

  private near(c: Creature) {
    return c.position.distanceTo(this.ear.position) < 45;
  }

  private catch(a: Creature, b: Creature) {
    const mutual = eats(b, a);
    const r = resolveCatch(mutual, Math.random());
    if (r === 'predator') this.eat(a, b);
    else if (r === 'prey') this.eat(b, a);
    else {
      // Got away! The prey zooms off (both do, after a scrap); the hunter shakes it off.
      b.scare(a);
      if (mutual) a.scare(b);
      else a.miss();
      this.fx.burst(b.position, 4, 'dash', Math.max(1, b.radius * 0.4));
      if (this.near(b)) this.sound.voice(b.sp.voice, b.sp.voiceBase);
    }
  }

  private eat(pred: Creature, prey: Creature) {
    this.fx.pop(prey.position, prey.radius);
    this.fx.burst(pred.position, 3, 'yum', Math.max(1, pred.radius * 0.3));
    if (this.near(pred)) {
      this.sound.gulp();
      this.sound.pop();
    }
    pred.chomp(1.2, true);
    this.respawn(prey);
  }

  private nibble(a: Creature, plant: Creature) {
    plant.bite();
    a.chomp(2.5);
    this.fx.burst(plant.position, 3, 'bubble', Math.max(1, plant.radius * 0.3));
    this.fx.burst(a.position, 2, 'yum', Math.max(1, a.radius * 0.4));
    if (this.near(a)) this.sound.pop();
  }

  /** Teleport to somewhere the player isn't looking at (and isn't close to). */
  private respawn(c: Creature) {
    m.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m);
    let far: [number, number] | null = null;
    let farD = -1;
    for (let i = 0; i < 24; i++) {
      const spot = c.randomSpot();
      ball.set(tmp.set(spot[0], -24, spot[1]), c.radius + 20);
      const d = tmp.distanceTo(this.ear.position);
      if (d > 30 && !frustum.intersectsSphere(ball)) {
        far = spot;
        break;
      }
      if (d > farD) [far, farD] = [spot, d];
    }
    c.moveTo(...far!);
  }
}
