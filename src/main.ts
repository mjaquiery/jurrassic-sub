import * as THREE from 'three';
import './style.css';
import { Sound } from './audio';
import { spawnCreatures, type Creature } from './creatures';
import { Ecology } from './ecology';
import { Fx } from './fx';
import { bounceYaw, CRUISE_ABOVE_FLOOR, pickTarget, steerInput, seabedY, SURFACE_Y, WORLD_RADIUS, type Candidate } from './logic';
import { renderPortrait } from './portrait';
import { REGIONS, type Region } from './regions';
import { MUSEUM, SPECIES, dietLines, type Species } from './species';
import { World } from './world';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- keep a toddler inside the game ----------------------------------------
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick'])
  document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
// Multi-finger touches are how iPadOS switches apps and zooms, so ignore extras.
document.addEventListener('touchstart', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false });

// ---- renderer, scene, camera -------------------------------------------------
const canvas = $<HTMLCanvasElement>('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

const fx = new Fx(scene);
const sound = new Sound();
// Distance beyond which plants are hidden: the fog has swallowed them anyway.
const PLANT_CULL = 85;

// ---- the sub -----------------------------------------------------------------
function buildSub() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshLambertMaterial({ color: 0xffd23f, flatShading: true });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, s: [number, number, number], at: [number, number, number]) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.scale.set(...s);
    mesh.position.set(...at);
    g.add(mesh);
    return mesh;
  };
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  add(sphere, yellow, [1.4, 0.85, 0.85], [0, 0, 0]);
  add(sphere, new THREE.MeshLambertMaterial({ color: 0xff6b6b, flatShading: true }), [0.9, 0.12, 0.6], [-0.1, 0.8, 0]);
  const glass = new THREE.MeshLambertMaterial({ color: 0xbfefff, transparent: true, opacity: 0.8 });
  add(sphere, glass, [0.5, 0.42, 0.5], [0.85, 0.2, 0]);
  add(sphere, new THREE.MeshLambertMaterial({ color: 0xff9f43 }), [0.2, 0.2, 0.2], [0.85, 0.12, 0]);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), yellow, [1, 1, 1], [0, 1.0, 0]);
  add(new THREE.BoxGeometry(1, 1, 1), yellow, [0.9, 0.08, 0.6], [-0.2, -0.85, 0]);
  const prop = new THREE.Group();
  prop.position.set(-1.5, 0, 0);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.18), new THREE.MeshLambertMaterial({ color: 0xff6b6b }));
    blade.position.y = 0.3;
    const arm = new THREE.Group();
    arm.rotation.x = (i * Math.PI * 2) / 3;
    arm.add(blade);
    prop.add(arm);
  }
  g.add(prop);
  const lamp = new THREE.PointLight(0xfff2c0, 40, 30);
  lamp.position.set(2.2, 0, 0);
  g.add(lamp);
  g.userData.prop = prop;
  return g;
}
const sub = buildSub();
// First person: we look out from inside, so hide the hull but keep the lamp.
sub.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.visible = false) : undefined));
scene.add(sub);
const subState = { yaw: Math.PI / 2, pitch: 0, speed: 0, roll: 0 };
sub.position.set(0, -30, 0);
const MAX_SPEED = 7;

// ---- regions -------------------------------------------------------------------
let world: World | undefined;
let creatures: Creature[] = [];
let ecology: Ecology;
let region = REGIONS[0];
let current: Creature | null = null;
let lostAt = 0;
let paused = false;

function loadRegion(r: Region) {
  world?.dispose();
  for (const c of creatures) scene.remove(c.obj);
  region = r;
  world = new World(scene, r);
  creatures = spawnCreatures(r);
  for (const c of creatures) scene.add(c.obj);
  ecology = new Ecology(creatures, fx, sound, camera, sub);
  current = null;
  showTarget(null);
  sub.position.set(0, -30, 0);
  Object.assign(subState, { yaw: Math.PI / 2, pitch: 0, speed: 0, roll: 0 });
}

// ---- input: touch anywhere to glide towards where you point --------------------
const touch = { active: false, x: 0, y: 0, sx: 0, sy: 0, t0: 0 };
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  Object.assign(touch, { active: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now() });
  $('hint').classList.add('gone');
});
canvas.addEventListener('pointermove', (e) => {
  if (touch.active) Object.assign(touch, { x: e.clientX, y: e.clientY });
});
const release = (e: PointerEvent) => {
  if (!touch.active) return;
  touch.active = false;
  const quick = performance.now() - touch.t0 < 300 && Math.hypot(e.clientX - touch.sx, e.clientY - touch.sy) < 14;
  if (quick) tap(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

const ray = new THREE.Raycaster();
const sphere = new THREE.Sphere();
const hitPoint = new THREE.Vector3();
function tap(px: number, py: number) {
  ray.setFromCamera(new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1), camera);
  let best: Creature | null = null;
  let bestD = Infinity;
  for (const c of creatures) {
    sphere.set(c.position, Math.max(1, c.radius * 1.1));
    if (ray.ray.intersectSphere(sphere, hitPoint)) {
      const d = hitPoint.distanceTo(camera.position);
      if (d < bestD) [best, bestD] = [c, d];
    }
  }
  if (best) startle(best, 'tap');
}

function startle(c: Creature, kind: 'tap' | 'bump') {
  if (c.reacting) return;
  c.trigger(kind, sub.position);
  if (kind === 'bump' && c.reacting) sound.bump();
  if (c.reacting) {
    sound.voice(c.sp.voice, c.sp.voiceBase);
    fx.burst(c.position, 8, 'bubble', Math.max(1, c.radius * 0.4));
    fx.burst(c.position, 3, 'heart', Math.max(1, c.radius * 0.3));
  }
}

// ---- identification UI ---------------------------------------------------------
const portraits = new Map<string, string>();
const screen = $<HTMLButtonElement>('screen');
const reticle = $('reticle');

/** The dashboard screen shows the creature in the reticle; pressing it makes you look down for details. */
function showTarget(c: Creature | null) {
  screen.disabled = !c;
  screen.classList.toggle('live', c !== null);
  if (!c) return;
  $<HTMLImageElement>('screen-img').src = portraits.get(c.sp.id)!;
  $('screen-name').textContent = c.sp.name;
  // Restart the pop-in animation.
  screen.classList.remove('ping');
  void screen.offsetWidth;
  screen.classList.add('ping');
}

function openInfo(sp: Species) {
  paused = true;
  $<HTMLImageElement>('info-img').src = portraits.get(sp.id)!;
  $('info-name').textContent = sp.name;
  const ul = $('info-facts');
  ul.replaceChildren(...[...sp.facts, ...dietLines(sp)].map((f) => Object.assign(document.createElement('li'), { textContent: f })));
  $('info-museum').textContent = '🏛️ ' + MUSEUM;
  $('info').hidden = false;
}
function closeInfo() {
  $('info').hidden = true;
  paused = false;
}
screen.addEventListener('click', () => current && openInfo(current.sp));
$('info').addEventListener('click', closeInfo);
$('mute').addEventListener('click', () => {
  sound.setMuted(!sound.isMuted);
  $('mute').textContent = sound.isMuted ? '🔇' : '🔊';
});

function identify(now: number) {
  const v = new THREE.Vector3();
  const aspect = camera.aspect;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const cands: Candidate[] = creatures.map((c) => {
    v.copy(c.position).applyMatrix4(camera.matrixWorldInverse);
    const depth = -v.z;
    const dist = c.position.distanceTo(sub.position);
    v.copy(c.position).project(camera);
    return {
      id: c.id,
      ndcX: v.x,
      ndcY: v.y,
      depth,
      dist,
      range: c.range,
      apparent: c.radius / (Math.max(depth, 0.1) * tanHalf),
    };
  });
  const id = pickTarget(cands, aspect, current?.id ?? null);
  if (id !== null) {
    lostAt = 0;
    if (current?.id !== id) {
      current = creatures[id];
      showTarget(current);
      sound.chime();
      current.trigger('hello', sub.position);
      fx.burst(current.position, 3, 'heart', Math.max(1, current.radius * 0.3));
    }
  } else if (current) {
    lostAt ||= now;
    if (now - lostAt > 0.6) {
      current = null;
      showTarget(null);
    }
  }
  reticle.classList.toggle('lock', current !== null && lostAt === 0);
}

// ---- main loop -----------------------------------------------------------------
const fwd = new THREE.Vector3();
const want = new THREE.Vector3();
let nextEdgeBump = 0;
const nextPaint = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
let lookDown = 0;
let last = performance.now();
let started = false;

function stepSub(dt: number) {
  const s = subState;
  if (touch.active) {
    const { yaw, pitch } = steerInput(touch.x, touch.y, window.innerWidth, window.innerHeight);
    s.yaw += yaw * 1.3 * dt;
    s.pitch = THREE.MathUtils.clamp(s.pitch + pitch * 0.9 * dt, -0.7, 0.7);
    s.speed += (MAX_SPEED - s.speed) * Math.min(1, dt * 1.2);
    s.roll += (yaw * 0.5 - s.roll) * Math.min(1, dt * 3);
  } else {
    s.speed *= Math.exp(-1.1 * dt);
    s.pitch *= Math.exp(-0.4 * dt);
    s.roll *= Math.exp(-3 * dt);
    // Left alone, the sub settles down near the sea floor, where the interesting things are.
    const cruise = seabedY(sub.position.x, sub.position.z) + CRUISE_ABOVE_FLOOR;
    sub.position.y += (cruise - sub.position.y) * Math.min(1, dt * 0.35);
  }
  fwd.set(Math.cos(s.pitch) * Math.cos(s.yaw), Math.sin(s.pitch), -Math.cos(s.pitch) * Math.sin(s.yaw));
  sub.position.addScaledVector(fwd, s.speed * dt);
  sub.position.y = THREE.MathUtils.clamp(sub.position.y, seabedY(sub.position.x, sub.position.z) + 1.5, SURFACE_Y);
  const r = Math.hypot(sub.position.x, sub.position.z);
  if (r > WORLD_RADIUS) {
    // The boundary wall glows as you approach; touching it bounces you back in like a rubber wall.
    s.yaw = bounceYaw(s.yaw, sub.position.x, sub.position.z);
    sub.position.x *= (WORLD_RADIUS - 0.5) / r;
    sub.position.z *= (WORLD_RADIUS - 0.5) / r;
    s.speed = Math.max(s.speed, 5);
    s.roll += Math.random() < 0.5 ? 0.6 : -0.6;
    if (performance.now() > nextEdgeBump) {
      nextEdgeBump = performance.now() + 400;
      sound.boing();
      fx.burst(sub.position.clone().addScaledVector(fwd, -2), 6, 'bubble', 1.2);
    }
  }
  sub.rotation.set(s.roll, s.yaw, s.pitch, 'XYZ');
  (sub.userData.prop as THREE.Object3D).rotation.x += dt * (4 + s.speed * 6);

  for (const c of creatures) {
    const d = c.position.distanceTo(sub.position);
    const min = c.radius * 0.55 + 1.2;
    if (d < min) {
      // Soft shove so the sub never sits inside a creature, plus a friendly reaction.
      want.copy(sub.position).sub(c.position).setLength(min - d);
      sub.position.add(want);
      s.speed *= 0.5;
      startle(c, 'bump');
    }
  }
}

/** First person: eyes in the glass dome, banking a little in turns, tipping down to read the screen. */
function placeCamera(t: number) {
  const s = subState;
  fwd.set(Math.cos(s.pitch) * Math.cos(s.yaw), Math.sin(s.pitch), -Math.cos(s.pitch) * Math.sin(s.yaw));
  camera.position.copy(sub.position).addScaledVector(fwd, 0.7);
  camera.position.y += 0.35 + Math.sin(t * 1.3) * 0.03;
  camera.lookAt(camera.position.x + fwd.x, camera.position.y + fwd.y, camera.position.z + fwd.z);
  camera.rotateZ(s.roll * 0.3);
  camera.rotateX(-lookDown * 0.5);
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
}

function frame(nowMs: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  const t = nowMs / 1000;
  const running = started && !paused;
  if (running) {
    stepSub(dt);
    for (const c of creatures) {
      if (c.flora) c.obj.visible = camera.position.distanceToSquared(c.position) < PLANT_CULL * PLANT_CULL;
      c.update(dt, t);
    }
    ecology.update(dt);
    fx.update(dt);
  }
  lookDown += ((paused ? 1 : 0) - lookDown) * Math.min(1, dt * 5);
  placeCamera(t);
  if (running) {
    identify(t);
    const edge = world?.update(camera.position, t, sub.position) ?? 0;
    $('edge').style.opacity = String(Math.max(0, (edge - 0.6) / 0.4));
    sound.update(subState.speed / MAX_SPEED);
  }
  renderer.render(scene, camera);
}

// ---- start ---------------------------------------------------------------------
for (const sp of SPECIES) portraits.set(sp.id, renderPortrait(renderer, sp));
loadRegion(region);
placeCamera(0);
requestAnimationFrame(frame);

$('version').textContent = 'v' + __APP_VERSION__;
let soundOn = false;
const regionsEl = $('regions');
for (const r of REGIONS) {
  const b = document.createElement('button');
  b.className = 'region';
  b.dataset.region = r.id;
  b.setAttribute('aria-label', r.name);
  b.innerHTML = `<span class="em">${r.emoji}</span><span>${r.name}</span>`;
  b.addEventListener('click', async () => {
    if (!soundOn) {
      sound.start();
      soundOn = true;
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
    // Building a region and compiling its shaders stalls for a moment, so show something first.
    $('loading-emoji').textContent = r.emoji;
    $('loading').hidden = false;
    $('start').hidden = true;
    await nextPaint();
    if (r !== region) loadRegion(r);
    placeCamera(0);
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    $('loading').hidden = true;
    $('start').hidden = true;
    $('hud').hidden = false;
    started = true;
    last = performance.now();
  });
  regionsEl.append(b);
}
// The map button goes back to the dive-site menu.
$('map').addEventListener('click', () => {
  started = false;
  $('hud').hidden = true;
  $('start').hidden = false;
});
document.addEventListener('visibilitychange', () => sound.pause(document.hidden));

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Test hook: lets the e2e suite see what the player sees.
(window as unknown as { __jsub: unknown }).__jsub = {
  get target() {
    return current?.sp.id ?? null;
  },
  get creatures() {
    return creatures;
  },
  get region() {
    return region.id;
  },
  get ecology() {
    return ecology;
  },
  sub,
  subState,
};
