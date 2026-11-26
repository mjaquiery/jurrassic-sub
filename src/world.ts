import * as THREE from 'three';
import { seabedY } from './logic';

export const WATER = 0x1f86b0;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SNOW_COUNT = 500;
const SNOW_BOX = 36;

export class World {
  private snow: THREE.Points;
  private snowBase = new Float32Array(SNOW_COUNT * 3);
  private shafts: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    const rand = rng(7);
    scene.background = new THREE.Color(WATER);
    scene.fog = new THREE.FogExp2(WATER, 0.024);
    scene.add(new THREE.HemisphereLight(0xcdf3ff, 0x6a7f6a, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(20, 60, 10);
    scene.add(sun);

    this.addSeabed(scene, rand);
    this.addDecor(scene, rand);
    this.addShafts(scene, rand);

    const pos = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < this.snowBase.length; i++) this.snowBase[i] = rand() * SNOW_BOX * 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xe8fbff, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.snow.frustumCulled = false;
    scene.add(this.snow);
  }

  private addSeabed(scene: THREE.Scene, rand: () => number) {
    const geo = new THREE.PlaneGeometry(340, 340, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const sand = new THREE.Color(0xcdb98c);
    const mud = new THREE.Color(0x8d9aa0);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      p.setY(i, seabedY(p.getX(i), p.getZ(i)) + (rand() - 0.5) * 0.5);
      c.copy(sand).lerp(mud, 0.5 + 0.5 * Math.sin(p.getX(i) * 0.04 + p.getZ(i) * 0.06) + (rand() - 0.5) * 0.2);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  }

  /** Rocks, corals and sea lilies (crinoids), all instanced so they cost a few draw calls. */
  private addDecor(scene: THREE.Scene, rand: () => number) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const scatter = (n: number, spread: number, fn: (i: number, x: number, y: number, z: number) => void) => {
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * spread;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        fn(i, x, seabedY(x, z), z);
      }
    };

    const rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0x8793a0, flatShading: true }),
      60,
    );
    scatter(60, 120, (i, x, y, z) => {
      const s = 0.8 + rand() * 2.5;
      q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3));
      rocks.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * 1.3, s * 0.8, s)));
    });
    scene.add(rocks);

    const palette = [0xff7f8a, 0xffb36b, 0xc79bff, 0x7be0c8];
    const corals = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshLambertMaterial({ flatShading: true }),
      90,
    );
    scatter(90, 120, (i, x, y, z) => {
      const s = 0.4 + rand() * 1.1;
      corals.setMatrixAt(i, m.compose(new THREE.Vector3(x, y + s * 0.5, z), q.identity(), new THREE.Vector3(s, s * 1.3, s)));
      corals.setColorAt(i, new THREE.Color(palette[i % palette.length]));
    });
    scene.add(corals);

    const stems = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.07, 0.1, 1, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a6c2, flatShading: true }),
      80,
    );
    const cups = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.5, 0.7, 7, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xff8fab, flatShading: true, side: THREE.DoubleSide }),
      80,
    );
    scatter(80, 120, (i, x, y, z) => {
      const h = 1.5 + rand() * 2.5;
      stems.setMatrixAt(i, m.compose(new THREE.Vector3(x, y + h / 2, z), q.identity(), new THREE.Vector3(1, h, 1)));
      const s = 0.8 + rand() * 0.6;
      // Cone point down so it opens like a flower cup.
      q.setFromEuler(e.set(Math.PI, 0, 0));
      cups.setMatrixAt(i, m.compose(new THREE.Vector3(x, y + h + 0.3, z), q, new THREE.Vector3(s, s, s)));
    });
    scene.add(stems, cups);
  }

  private addShafts(scene: THREE.Scene, rand: () => number) {
    const geo = new THREE.CylinderGeometry(6, 1.5, 60, 12, 1, true);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const k = Math.max(0, p.getY(i) / 60 + 0.5); // bright at the top, black (invisible when additive) below
      col.fill(k * k, i * 3, i * 3 + 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      color: 0xbfeeff,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(geo, material);
      const a = rand() * Math.PI * 2;
      const r = 15 + rand() * 70;
      s.position.set(Math.cos(a) * r, -30, Math.sin(a) * r);
      s.rotation.z = 0.25;
      s.userData.phase = rand() * 6;
      scene.add(s);
      this.shafts.push(s);
    }
  }

  update(cam: THREE.Vector3, t: number) {
    for (const s of this.shafts) s.rotation.x = Math.sin(t * 0.15 + s.userData.phase) * 0.08;
    const pos = this.snow.geometry.attributes.position as THREE.BufferAttribute;
    const L = SNOW_BOX * 2;
    const wrap = (v: number, c: number) => ((((v - c) % L) + L) % L) - SNOW_BOX + c;
    for (let i = 0; i < SNOW_COUNT; i++) {
      const b = i * 3;
      pos.setXYZ(
        i,
        wrap(this.snowBase[b] + Math.sin(t * 0.3 + i) * 0.5, cam.x),
        wrap(this.snowBase[b + 1] + t * 0.15, cam.y),
        wrap(this.snowBase[b + 2] + Math.cos(t * 0.25 + i) * 0.5, cam.z),
      );
    }
    pos.needsUpdate = true;
  }
}
