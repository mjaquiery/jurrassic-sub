import * as THREE from 'three';
import type { Species } from './species';

/** Render a species model to a PNG data URL, so portraits always match the in-game look. */
export function renderPortrait(renderer: THREE.WebGLRenderer, sp: Species, size = 384): string {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sp.bg);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7c0, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);

  const model = sp.build();
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  model.position.sub(centre);
  const holder = new THREE.Group();
  holder.rotation.y = -0.45;
  holder.add(model);
  scene.add(holder);

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
