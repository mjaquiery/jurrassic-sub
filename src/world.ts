import * as THREE from 'three';
import { edgeGlow, seabedY, WORLD_RADIUS } from './logic';
import type { Region } from './regions';

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

/** Hazard-stripe and bubble pattern for the zone boundary. */
function wallTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 14;
  for (let i = -2; i < 4; i++) {
    g.beginPath();
    g.moveTo(i * 64, 128);
    g.lineTo(i * 64 + 128, 0);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [x, y, r] of [[30, 30, 8], [96, 84, 10], [60, 110, 6], [110, 20, 5]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(48, 5);
  return t;
}

export class World {
  private root = new THREE.Group();
  private snow: THREE.Points;
  private snowBase = new Float32Array(SNOW_COUNT * 3);
  private shafts: THREE.Mesh[] = [];
  private wall: THREE.Mesh;

  constructor(
    private scene: THREE.Scene,
    private region: Region,
  ) {
    const rand = rng(region.seed);
    scene.background = new THREE.Color(region.water);
    scene.fog = new THREE.FogExp2(region.water, region.fog);
    this.root.add(new THREE.HemisphereLight(0xcdf3ff, 0x6a7f6a, 2.4 * region.light));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6 * region.light);
    sun.position.set(20, 60, 10);
    this.root.add(sun);
    scene.add(this.root);

    this.addSeabed(this.root, rand);
    this.addRocks(this.root, rand);
    this.addShafts(this.root, rand);

    this.wall = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD_RADIUS + 1.5, WORLD_RADIUS + 1.5, 46, 96, 1, true),
      new THREE.MeshBasicMaterial({
        map: wallTexture(),
        color: region.wall,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    this.wall.position.y = -26;
    this.root.add(this.wall);

    const pos = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < this.snowBase.length; i++) this.snowBase[i] = rand() * SNOW_BOX * 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xe8fbff, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.snow.frustumCulled = false;
    this.root.add(this.snow);
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
  }

  private addSeabed(scene: THREE.Object3D, rand: () => number) {
    const geo = new THREE.PlaneGeometry(340, 340, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const sand = new THREE.Color(this.region.sand);
    const mud = new THREE.Color(this.region.mud);
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

  private addRocks(scene: THREE.Object3D, rand: () => number) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0x8793a0, flatShading: true }),
      60,
    );
    for (let i = 0; i < 60; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 120;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const s = 0.8 + rand() * 2.5;
      q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3));
      rocks.setMatrixAt(i, m.compose(new THREE.Vector3(x, seabedY(x, z), z), q, new THREE.Vector3(s * 1.3, s * 0.8, s)));
    }
    scene.add(rocks);
  }

  private addShafts(scene: THREE.Object3D, rand: () => number) {
    const geo = new THREE.CylinderGeometry(14, 3, 90, 12, 1, true);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const k = Math.max(0, p.getY(i) / 90 + 0.5); // bright at the top, black (invisible when additive) below
      col.fill(k * k, i * 3, i * 3 + 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      color: 0xbfeeff,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(geo, material);
      const a = rand() * Math.PI * 2;
      const r = 15 + rand() * 70;
      s.position.set(Math.cos(a) * r, -5, Math.sin(a) * r);
      s.rotation.z = 0.25;
      s.userData.phase = rand() * 6;
      scene.add(s);
      this.shafts.push(s);
    }
  }

  /** Advances the ambience and returns how close the sub is to the boundary (0..1). */
  update(cam: THREE.Vector3, t: number, sub: THREE.Vector3): number {
    const edge = edgeGlow(Math.hypot(sub.x, sub.z));
    const mat = this.wall.material as THREE.MeshBasicMaterial;
    mat.opacity = edge * (0.5 + 0.15 * Math.sin(t * 4));
    this.wall.visible = edge > 0.001;
    mat.map!.offset.y = -t * 0.08;
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
    return edge;
  }
}
