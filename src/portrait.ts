import * as THREE from 'three';
import type { Species } from './species';

/** Soft radial backdrop in the species colour, lighter in the middle, darker at the rim. */
function backdrop(bg: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const base = new THREE.Color(bg);
  const css = (k: number) => '#' + base.clone().lerp(new THREE.Color(k > 0 ? 0xffffff : 0x1b3a57), Math.abs(k)).getHexString();
  const grad = g.createRadialGradient(128, 110, 10, 128, 128, 190);
  grad.addColorStop(0, css(0.6));
  grad.addColorStop(0.55, css(0));
  grad.addColorStop(1, css(-0.3));
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Dark "sticker" outline: a slightly fatter back-faced copy of every mesh. */
function outline(model: THREE.Object3D) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x16344f, side: THREE.BackSide });
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
  for (const m of meshes) {
    const o = new THREE.Mesh(m.geometry, mat);
    o.position.copy(m.position);
    o.quaternion.copy(m.quaternion);
    o.scale.copy(m.scale).multiplyScalar(1.05).addScalar(0.035);
    m.parent!.add(o);
  }
}

/** Blurry dark ellipse on the "floor" so the animal doesn't just float in the frame. */
function shadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(10,30,50,0.45)');
  grad.addColorStop(1, 'rgba(10,30,50,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Render a species model to a PNG data URL, so portraits always match the in-game look. */
export function renderPortrait(renderer: THREE.WebGLRenderer, sp: Species, size = 512): string {
  const scene = new THREE.Scene();
  scene.background = backdrop(sp.bg);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7c0, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa8ecff, 1.8);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const model = sp.build();
  outline(model);
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  const dims = box.getSize(new THREE.Vector3());
  const radius = dims.length() / 2;
  model.position.sub(centre);
  const holder = new THREE.Group();
  holder.rotation.y = -0.45;
  holder.add(model);
  scene.add(holder);

  const floor = shadow();
  floor.position.y = -dims.y / 2 - radius * 0.12;
  floor.scale.set(dims.x * 1.1, dims.x * 0.5, 1);
  scene.add(floor);

  // A few deterministic bubbles for a bit of underwater sparkle.
  const bub = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
  const geo = new THREE.IcosahedronGeometry(1, 1);
  let seed = [...sp.id].reduce((a, ch) => a + ch.charCodeAt(0), 7);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(geo, bub);
    b.scale.setScalar(radius * (0.03 + rnd() * 0.06));
    b.position.set((rnd() - 0.5) * radius * 2.6, (rnd() - 0.5) * radius * 2, -radius * (0.3 + rnd()));
    scene.add(b);
  }

  const fov = 32;
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(fov / 2)));
  cam.position.set(0, radius * 0.15, dist);
  cam.lookAt(0, 0, 0);

  const rt = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  const px = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
  renderer.setRenderTarget(prev);
  rt.dispose();

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  }
  g.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
