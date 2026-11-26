import * as THREE from 'three';

export type VoiceKind = 'whistle' | 'honk' | 'rumble' | 'croak' | 'whoop' | 'blip' | 'pop';

export interface Species {
  id: string;
  name: string;
  /** Portrait background colour. */
  bg: number;
  /** Nose-to-tail length (flora: width) in world units, roughly metres. */
  length: number;
  speed: number;
  /** Plants and other things that stay put. Defaults to 'fauna'. */
  kind?: 'fauna' | 'flora';
  /** Ids of the species this one hunts, or (for flora) grazes. Filled in from FOOD_WEB. */
  eats?: string[];
  voice: VoiceKind;
  voiceBase: number;
  /** Short facts shown (with a big emoji each) when the portrait is pressed. */
  facts: string[];
  build: () => THREE.Group;
}

export interface Anim {
  obj: THREE.Object3D;
  axis: 'x' | 'y' | 'z';
  amp: number;
  speed: number;
  phase: number;
  base: number;
}

// ---- tiny modelling kit: low-poly, flat shaded, cute -----------------------

const sphereGeo = new THREE.IcosahedronGeometry(1, 1);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const coneGeo = new THREE.ConeGeometry(1, 1, 6);
const capsuleGeo = new THREE.CapsuleGeometry(1, 1, 3, 8);
const arcGeo = new THREE.TorusGeometry(1, 0.14, 4, 10, Math.PI);

const mats = new Map<number, THREE.MeshLambertMaterial>();
const mat = (color: number) => {
  let m = mats.get(color);
  if (!m) mats.set(color, (m = new THREE.MeshLambertMaterial({ color, flatShading: true })));
  return m;
};

type P = THREE.Object3D;

function put(geo: THREE.BufferGeometry, color: number, s: [number, number, number], at: [number, number, number], parent: P) {
  const m = new THREE.Mesh(geo, mat(color));
  m.scale.set(...s);
  m.position.set(...at);
  parent.add(m);
  return m;
}
const blob = (parent: P, color: number, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) =>
  put(sphereGeo, color, [sx, sy, sz], [x, y, z], parent);
const box = (parent: P, color: number, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) =>
  put(boxGeo, color, [sx, sy, sz], [x, y, z], parent);

/** Cone with its base at x, pointing along +X (or -X when `back`). */
function coneX(parent: P, color: number, r: number, len: number, x: number, y = 0, z = 0, back = false) {
  const m = put(coneGeo, color, [r, len, r], [x + (back ? -len : len) / 2, y, z], parent);
  m.rotation.z = back ? Math.PI / 2 : -Math.PI / 2;
  return m;
}
/** Cone with its base at y, pointing up (or down), swept backwards by `sweep`. */
function coneY(parent: P, color: number, r: number, len: number, x: number, y: number, z = 0, down = false, sweep = 0.5) {
  const m = put(coneGeo, color, [r, len, r], [x, y + (down ? -len : len) / 2, z], parent);
  m.rotation.z = down ? Math.PI - sweep : sweep;
  return m;
}

function eyes(parent: P, x: number, y: number, z: number, r: number) {
  for (const s of [-1, 1]) {
    blob(parent, 0xffffff, r, r, r, x, y, z * s);
    blob(parent, 0x1b2a41, r * 0.62, r * 0.66, r * 0.62, x + r * 0.45, y - r * 0.05, z * s);
    blob(parent, 0xffffff, r * 0.22, r * 0.22, r * 0.22, x + r * 0.8, y + r * 0.28, z * s * 0.95);
  }
}
function cheeks(parent: P, x: number, y: number, z: number, r: number) {
  for (const s of [-1, 1]) blob(parent, 0xff9bb0, r, r * 0.7, r * 0.4, x, y, z * s);
}
function smile(parent: P, x: number, y: number, r: number) {
  const m = put(arcGeo, 0x7a3b4a, [r, r, r], [x, y, 0], parent);
  m.rotation.set(0, Math.PI / 2, Math.PI);
}

function pivot(parent: P, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
/** Mark an object as animated; the creature loop turns this into motion. */
function anim(obj: P, axis: Anim['axis'], amp: number, speed: number, phase = 0) {
  (obj.userData.anims ??= [] as Omit<Anim, 'obj' | 'base'>[]).push({ axis, amp, speed, phase });
}

function flipper(parent: P, color: number, x: number, y: number, side: number, len: number, wide: number, phase: number) {
  const p = pivot(parent, x, y, side * 0.55);
  const f = blob(p, color, wide, 0.07, len, -wide * 0.2, 0, side * len * 0.8);
  f.rotation.x = side * 0.25;
  anim(p, 'x', 0.45, 4, phase);
}

// ---- species builders -------------------------------------------------------

function ichthyosaur(): THREE.Group {
  const g = new THREE.Group();
  const c = 0x5b8fd6;
  blob(g, c, 1.5, 0.9, 0.9);
  blob(g, 0xdfeeff, 1.35, 0.6, 0.8, 0.05, -0.28, 0);
  blob(g, c, 0.75, 0.65, 0.65, 1.35, 0.05, 0);
  coneX(g, c, 0.3, 1.1, 1.8, 0, 0);
  eyes(g, 1.55, 0.22, 0.45, 0.4);
  cheeks(g, 1.7, -0.15, 0.5, 0.18);
  coneY(g, c, 0.35, 0.7, 0, 0.8, 0, false, 0.5);
  flipper(g, c, 0.6, -0.4, 1, 0.6, 0.35, 0);
  flipper(g, c, 0.6, -0.4, -1, 0.6, 0.35, Math.PI);
  const tail = pivot(g, -1.4, 0, 0);
  blob(tail, c, 0.7, 0.35, 0.3, -0.5, 0, 0);
  coneY(tail, c, 0.28, 0.75, -1.1, 0.05, 0, false, 0.45);
  coneY(tail, c, 0.28, 0.75, -1.1, -0.05, 0, true, 0.45);
  anim(tail, 'y', 0.4, 4);
  return g;
}

interface PlesiOpts {
  color: number;
  belly: number;
  neckSegs: number;
  segLen: number;
}
function plesiosaur({ color, belly, neckSegs, segLen }: PlesiOpts): THREE.Group {
  const g = new THREE.Group();
  blob(g, color, 1.5, 0.85, 1.0);
  blob(g, belly, 1.35, 0.55, 0.9, 0.05, -0.3, 0);
  flipper(g, color, 0.8, -0.45, 1, 0.9, 0.5, 0);
  flipper(g, color, 0.8, -0.45, -1, 0.9, 0.5, Math.PI);
  flipper(g, color, -0.8, -0.45, 1, 0.9, 0.5, Math.PI);
  flipper(g, color, -0.8, -0.45, -1, 0.9, 0.5, 0);
  const tail = pivot(g, -1.3, 0, 0);
  coneX(tail, color, 0.4, 1.1, 0, 0, 0, true);
  anim(tail, 'y', 0.3, 3);
  let p: P = pivot(g, 1.2, 0.35, 0);
  for (let i = 0; i < neckSegs; i++) {
    const bend = 1.0 / (neckSegs / 2);
    p.rotation.z = i < neckSegs / 2 ? bend : -bend;
    anim(p, 'y', 0.12, 1.6, i * 0.5);
    const r = 0.5 - (i / neckSegs) * 0.22;
    blob(p, color, segLen * 0.62, r, r, segLen * 0.5, 0, 0);
    const next = pivot(p, segLen, 0, 0);
    p = next;
  }
  p.rotation.z = 0.2;
  blob(p, color, 0.55, 0.4, 0.4, 0.3, 0, 0);
  coneX(p, color, 0.22, 0.5, 0.7, -0.05, 0);
  eyes(p, 0.45, 0.2, 0.28, 0.2);
  cheeks(p, 0.6, -0.1, 0.3, 0.1);
  return g;
}

interface PlioOpts {
  color: number;
  belly: number;
  head: number;
}
function pliosaur({ color, belly, head }: PlioOpts): THREE.Group {
  const g = new THREE.Group();
  blob(g, color, 1.5, 0.95, 1.05);
  blob(g, belly, 1.35, 0.6, 0.95, 0.05, -0.33, 0);
  flipper(g, color, 0.8, -0.5, 1, 1.0, 0.6, 0);
  flipper(g, color, 0.8, -0.5, -1, 1.0, 0.6, Math.PI);
  flipper(g, color, -0.8, -0.5, 1, 1.0, 0.6, Math.PI);
  flipper(g, color, -0.8, -0.5, -1, 1.0, 0.6, 0);
  const tail = pivot(g, -1.3, 0, 0);
  coneX(tail, color, 0.45, 1.2, 0, 0, 0, true);
  anim(tail, 'y', 0.3, 3);
  blob(g, color, 0.7, 0.55, 0.6, 1.5, 0.05, 0);
  blob(g, color, head, 0.42, 0.5, 2.1 + head * 0.3, -0.05, 0);
  blob(g, belly, head * 0.9, 0.2, 0.42, 2.1 + head * 0.3, -0.28, 0);
  eyes(g, 1.9, 0.38, 0.42, 0.3);
  cheeks(g, 2.1, -0.08, 0.5, 0.17);
  smile(g, 2.1 + head * 1.25, -0.1, 0.22);
  return g;
}

function metriorhynchus(): THREE.Group {
  const g = new THREE.Group();
  const c = 0x7fb069;
  blob(g, c, 1.8, 0.55, 0.6);
  blob(g, 0xe8e4a0, 1.6, 0.35, 0.5, 0.05, -0.22, 0);
  blob(g, c, 0.7, 0.45, 0.5, 1.7, 0.05, 0);
  blob(g, c, 1.0, 0.28, 0.36, 2.5, -0.02, 0);
  blob(g, 0xe8e4a0, 0.9, 0.12, 0.3, 2.5, -0.17, 0);
  eyes(g, 1.85, 0.4, 0.3, 0.25);
  cheeks(g, 2.1, 0, 0.38, 0.13);
  smile(g, 3.0, -0.08, 0.15);
  flipper(g, c, 0.9, -0.3, 1, 0.5, 0.3, 0);
  flipper(g, c, 0.9, -0.3, -1, 0.5, 0.3, Math.PI);
  const tail = pivot(g, -1.6, 0, 0);
  blob(tail, c, 1.0, 0.3, 0.28, -0.8, 0, 0);
  coneY(tail, c, 0.32, 0.9, -1.8, 0, 0, true, 0.3);
  coneY(tail, c, 0.2, 0.4, -1.8, 0, 0, false, 0.3);
  anim(tail, 'y', 0.45, 4);
  return g;
}

function leedsichthys(): THREE.Group {
  const g = new THREE.Group();
  const c = 0x9fc3e8;
  blob(g, c, 2.6, 1.1, 0.85);
  blob(g, 0xf4f9ff, 2.4, 0.7, 0.8, 0.1, -0.38, 0);
  blob(g, c, 1.0, 0.95, 0.8, 2.3, 0, 0);
  blob(g, 0x3a4d6b, 0.3, 0.45, 0.5, 3.2, -0.15, 0);
  eyes(g, 2.7, 0.45, 0.62, 0.3);
  cheeks(g, 2.95, 0.05, 0.66, 0.22);
  smile(g, 3.25, -0.2, 0.45);
  for (let i = 0; i < 3; i++) box(g, 0x7aa3cc, 0.05, 0.6, 0.02, 1.6 - i * 0.25, 0, 0.8);
  coneY(g, c, 0.4, 0.8, 0, 1.0, 0, false, 0.6);
  flipper(g, c, 1.6, -0.6, 1, 0.7, 0.4, 0);
  flipper(g, c, 1.6, -0.6, -1, 0.7, 0.4, Math.PI);
  const tail = pivot(g, -2.5, 0, 0);
  blob(tail, c, 0.8, 0.4, 0.3, -0.5, 0, 0);
  coneY(tail, c, 0.45, 1.5, -1.1, 0.05, 0, false, 0.5);
  coneY(tail, c, 0.45, 1.5, -1.1, -0.05, 0, true, 0.5);
  anim(tail, 'y', 0.3, 2);
  return g;
}

function ammonite(): THREE.Group {
  const g = new THREE.Group();
  const turns = 3.2 * Math.PI;
  for (let i = 0; i < 16; i++) {
    const th = (i / 15) * turns;
    const a = th - turns + Math.PI * 0.2;
    const r = 0.1 + 0.075 * th;
    const s = 0.14 + 0.022 * th;
    blob(g, i % 2 ? 0xf4a259 : 0xf7c38b, s, s, s * 0.9, Math.cos(a) * r - 0.1, Math.sin(a) * r, 0);
  }
  const head = pivot(g, 0.85, -0.25, 0);
  blob(head, 0xffd9b3, 0.3, 0.26, 0.28);
  eyes(head, 0.15, 0.1, 0.17, 0.12);
  for (let i = -2; i <= 2; i++) {
    const t = coneX(head, 0xffd9b3, 0.05, 0.4, 0.25, -0.1, i * 0.08);
    t.rotation.y = i * 0.2;
  }
  anim(head, 'z', 0.15, 3);
  return g;
}

function belemnite(): THREE.Group {
  const g = new THREE.Group();
  const body = put(capsuleGeo, 0xb08968, [0.28, 0.9, 0.28], [0, 0, 0], g);
  body.rotation.z = Math.PI / 2;
  coneX(g, 0x7f5539, 0.12, 0.7, -1.2, 0, 0, true);
  blob(g, 0xe6ccb2, 0.35, 0.3, 0.3, 1.0, 0, 0);
  eyes(g, 1.15, 0.1, 0.2, 0.14);
  for (let i = -2; i <= 2; i++) {
    const t = coneX(g, 0xe6ccb2, 0.05, 0.55, 1.2, -0.05, i * 0.07);
    t.rotation.y = i * 0.15;
  }
  const fin = pivot(g, -0.5, 0.25, 0);
  coneY(fin, 0x7f5539, 0.15, 0.3, 0, 0, 0, false, 0.4);
  anim(fin, 'z', 0.3, 6);
  return g;
}

// ---- flora: things that sway, get nibbled and grow back -----------------------

function crinoid(): THREE.Group {
  const g = new THREE.Group();
  const stalk = 0xd9a6c2;
  const c = 0xff8fab;
  for (let i = 0; i < 4; i++) blob(g, stalk, 0.16, 0.34, 0.16, 0, i * 0.5, 0);
  const head = pivot(g, 0, 2.0, 0);
  blob(head, c, 0.32, 0.3, 0.32, 0, 0.05, 0);
  for (let i = 0; i < 5; i++) {
    const arm = pivot(head, 0, 0.15, 0);
    arm.rotation.y = (i * Math.PI * 2) / 5;
    coneY(arm, c, 0.12, 1.1, 0, 0, 0, false, -0.7);
    anim(arm, 'z', 0.12, 1.4, i);
  }
  anim(head, 'z', 0.06, 1.1);
  return g;
}

function coral(): THREE.Group {
  const g = new THREE.Group();
  const c = 0xff7f8a;
  blob(g, c, 0.55, 0.3, 0.55);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const len = 0.8 + (i % 3) * 0.3;
    const branch = pivot(g, Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2);
    branch.rotation.y = -a;
    coneY(branch, c, 0.2, len, 0, 0, 0, false, -0.5);
    blob(branch, 0xffc2c9, 0.2, 0.2, 0.2, len * 0.24, len * 0.94, 0);
    anim(branch, 'z', 0.05, 1.2, i);
  }
  return g;
}

function seaweed(): THREE.Group {
  const g = new THREE.Group();
  for (let s = 0; s < 3; s++) {
    let p: P = pivot(g, (s - 1) * 0.35, 0, (s % 2) * 0.2);
    for (let i = 0; i < 4; i++) {
      anim(p, 'z', 0.14, 1.3 + s * 0.2, i * 0.7 + s);
      blob(p, i % 2 ? 0x57c26a : 0x3fae5c, 0.14, 0.45, 0.05, 0, 0.4, 0);
      p = pivot(p, 0, 0.8, 0);
    }
  }
  return g;
}

function sponge(): THREE.Group {
  const g = new THREE.Group();
  const c = 0xf2d16b;
  blob(g, c, 0.7, 0.9, 0.7, 0, 0.9, 0);
  blob(g, 0xc99a2e, 0.45, 0.2, 0.45, 0, 1.75, 0);
  blob(g, c, 0.4, 0.6, 0.4, 0.75, 0.5, 0.2);
  blob(g, c, 0.32, 0.5, 0.32, -0.7, 0.4, -0.2);
  eyes(g, 0.62, 1.15, 0.25, 0.17);
  smile(g, 0.7, 0.75, 0.13);
  return g;
}

// ---- the Oxford Clay cast ----------------------------------------------------

const MUSEUM = 'Fossils from the Oxford Clay can be seen at the Oxford University Museum of Natural History.';

export const SPECIES: Species[] = [
  {
    id: 'ophthalmosaurus',
    name: 'Ophthalmosaurus',
    bg: 0xbfe3ff,
    length: 5,
    speed: 3.2,
    voice: 'whistle',
    voiceBase: 900,
    facts: [
      '👀 It had enormous eyes, some of the biggest for its size of any animal we know.',
      '🐬 It was shaped like a dolphin, but it was a reptile.',
      '🦑 It hunted squid in dim, deep water.',
    ],
    build: ichthyosaur,
  },
  {
    id: 'cryptoclidus',
    name: 'Cryptoclidus',
    bg: 0xc8f2e0,
    length: 5,
    speed: 2.2,
    voice: 'honk',
    voiceBase: 330,
    facts: [
      '🦢 Its long neck helped it snatch fish and squid.',
      '🚣 It rowed through the water with four flippers.',
      '🦴 Its fossils were found in clay near Peterborough.',
    ],
    build: () => plesiosaur({ color: 0x3fb59b, belly: 0xe6fff5, neckSegs: 8, segLen: 0.55 }),
  },
  {
    id: 'muraenosaurus',
    name: 'Muraenosaurus',
    bg: 0xffe3b8,
    length: 6,
    speed: 2,
    voice: 'honk',
    voiceBase: 260,
    facts: [
      '🦒 It had a super long neck with lots of tiny bones.',
      '🙂 Its head was small compared to its body.',
      '🐟 It ate small fish and squid.',
    ],
    build: () => plesiosaur({ color: 0xf29e4c, belly: 0xfff0d6, neckSegs: 12, segLen: 0.5 }),
  },
  {
    id: 'liopleurodon',
    name: 'Liopleurodon',
    bg: 0xe3d4ff,
    length: 8,
    speed: 2.4,
    voice: 'rumble',
    voiceBase: 90,
    facts: [
      '🚌 It was one of the biggest hunters in the sea, as long as a bus.',
      '👃 It could smell underwater, with a super sniffer.',
      '🏊 It swam with four strong flippers.',
    ],
    build: () => pliosaur({ color: 0x9a82db, belly: 0xf3ecff, head: 1.1 }),
  },
  {
    id: 'peloneustes',
    name: 'Peloneustes',
    bg: 0xfff1b0,
    length: 4.5,
    speed: 2.8,
    voice: 'rumble',
    voiceBase: 130,
    facts: [
      '🐚 It loved to eat ammonites and belemnites.',
      '🏊 It was a good swimmer with a smooth body.',
      '📏 It was about as long as a small boat.',
    ],
    build: () => pliosaur({ color: 0xe8a65d, belly: 0xfff3dc, head: 0.9 }),
  },
  {
    id: 'metriorhynchus',
    name: 'Metriorhynchus',
    bg: 0xd9f2b8,
    length: 5,
    speed: 3,
    voice: 'croak',
    voiceBase: 140,
    facts: [
      '🐊 It was a cousin of crocodiles that lived only in the sea.',
      '🐟 It had flippers and a fishy tail.',
      '🏖️ It never needed to come onto land.',
    ],
    build: metriorhynchus,
  },
  {
    id: 'leedsichthys',
    name: 'Leedsichthys',
    bg: 0xcfe6ff,
    length: 16,
    speed: 1.6,
    voice: 'whoop',
    voiceBase: 100,
    facts: [
      '🐋 It was the biggest fish ever known, bigger than a bus.',
      '🥣 It slurped up tiny floating food, like a whale does.',
      '😊 It was a gentle giant.',
    ],
    build: leedsichthys,
  },
  {
    id: 'ammonite',
    name: 'Ammonite',
    bg: 0xffe0c2,
    length: 1.4,
    speed: 0.9,
    voice: 'blip',
    voiceBase: 900,
    facts: [
      '🐌 Its curly shell kept it safe.',
      '🐙 It was a cousin of squid and octopus.',
      '🔎 Ammonite shells are found as fossils all over the world.',
    ],
    build: ammonite,
  },
  {
    id: 'belemnite',
    name: 'Belemnite',
    bg: 0xf3e4d2,
    length: 1.8,
    speed: 2.2,
    voice: 'pop',
    voiceBase: 600,
    facts: [
      '🦑 It looked like a squid with a hard, pointy tail.',
      '💨 It darted about in groups.',
      '⚡ Long ago people called its fossils thunderbolts.',
    ],
    build: belemnite,
  },
  {
    id: 'crinoid',
    name: 'Sea Lily',
    kind: 'flora',
    bg: 0xffd9e6,
    length: 1.8,
    speed: 0,
    voice: 'pop',
    voiceBase: 700,
    facts: [
      '🌸 It looks like a flower, but it is an animal, a cousin of starfish.',
      '🦶 A long stalk holds it to the sea floor.',
      '🌊 Its feathery arms catch tiny floating food.',
    ],
    build: crinoid,
  },
  {
    id: 'coral',
    name: 'Coral',
    kind: 'flora',
    bg: 0xffe0d6,
    length: 2.4,
    speed: 0,
    voice: 'pop',
    voiceBase: 520,
    facts: [
      '🪸 Corals are tiny animals that build a stony home together.',
      '🏠 Lots of little sea creatures hide among them.',
      '🏝️ Later, coral reefs grew in the warm seas near Oxford.',
    ],
    build: coral,
  },
  {
    id: 'seaweed',
    name: 'Seaweed',
    kind: 'flora',
    bg: 0xd3f5d8,
    length: 1.4,
    speed: 0,
    voice: 'pop',
    voiceBase: 450,
    facts: [
      '🌿 Seaweed is a kind of algae. It makes its food from sunlight.',
      '🐌 Small sea animals love to nibble it, and it grows back.',
      '🌊 It sways and dances with the water.',
    ],
    build: seaweed,
  },
  {
    id: 'sponge',
    name: 'Sponge',
    kind: 'flora',
    bg: 0xfff3c2,
    length: 2,
    speed: 0,
    voice: 'pop',
    voiceBase: 380,
    facts: [
      '🧽 A sponge is an animal that never moves.',
      '💧 It sucks in water and filters out tiny food.',
      '🕳️ It is full of teeny tiny holes.',
    ],
    build: sponge,
  },
];

/** Who munches whom. Plesiosaurs and ichthyosaurs follow their descriptions; the pliosaurs are the bullies. */
const FOOD_WEB: Record<string, string[]> = {
  ophthalmosaurus: ['belemnite', 'metriorhynchus'],
  cryptoclidus: ['belemnite'],
  muraenosaurus: ['belemnite'],
  liopleurodon: ['ophthalmosaurus', 'cryptoclidus', 'muraenosaurus', 'peloneustes', 'metriorhynchus', 'leedsichthys'],
  peloneustes: ['ammonite', 'belemnite'],
  metriorhynchus: ['belemnite', 'ophthalmosaurus'],
  ammonite: ['seaweed'],
};
for (const sp of SPECIES) sp.eats = FOOD_WEB[sp.id] ?? [];

const names = (list: Species[]) => list.map((s) => s.name).join(', ');

/** Extra kid-facing lines about who eats whom, derived from FOOD_WEB. */
export function dietLines(sp: Species): string[] {
  const eats = SPECIES.filter((s) => sp.eats?.includes(s.id));
  const hunters = SPECIES.filter((s) => s.eats?.includes(sp.id));
  const out: string[] = [];
  if (eats.length) out.push('😋 Munches: ' + names(eats));
  if (hunters.length) out.push(sp.kind === 'flora' ? '🐌 Nibbled by: ' + names(hunters) : '😱 Watch out for: ' + names(hunters));
  return out;
}


export { MUSEUM };
