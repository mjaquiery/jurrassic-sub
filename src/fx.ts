import * as THREE from 'three';

type Kind = 'bubble' | 'heart' | 'yum' | 'dash';

function emojiTexture(draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d')!);
  return new THREE.CanvasTexture(c);
}
const emoji = (e: string) =>
  emojiTexture((g) => {
    g.font = '48px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, 32, 36);
  });

interface Puff {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  /** Scale gained per second (used by the big pop bubble). */
  grow: number;
}

/** Pooled bubbles, hearts and cartoon puffs: the "yay" when something is tapped, bumped or gulped. */
export class Fx {
  private pool: Puff[] = [];
  private maps: Record<Kind, THREE.Texture>;

  constructor(scene: THREE.Scene, size = 140) {
    const bubble = emojiTexture((g) => {
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = 5;
      g.fillStyle = 'rgba(200,240,255,0.25)';
      g.beginPath();
      g.arc(32, 32, 26, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.arc(23, 22, 5, 0, Math.PI * 2);
      g.fill();
    });
    this.maps = { bubble, heart: emoji('💖'), yum: emoji('😋'), dash: emoji('💨') };
    for (let i = 0; i < size; i++) {
      // Each sprite owns its material so they can fade independently.
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubble, transparent: true, depthWrite: false }));
      sprite.visible = false;
      scene.add(sprite);
      this.pool.push({ sprite, vel: new THREE.Vector3(), life: 0, grow: 0 });
    }
  }

  private emit(at: THREE.Vector3, kind: Kind, scale: number, vel: THREE.Vector3, life: number, grow = 0) {
    const p = this.pool.find((q) => q.life <= 0);
    if (!p) return;
    p.life = life;
    p.grow = grow;
    p.vel.copy(vel);
    p.sprite.material.map = this.maps[kind];
    p.sprite.material.needsUpdate = true;
    p.sprite.position.copy(at);
    p.sprite.scale.setScalar(scale);
    p.sprite.visible = true;
  }

  burst(at: THREE.Vector3, n: number, kind: Kind, spread = 1) {
    const jitter = new THREE.Vector3();
    const start = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      jitter.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      start.copy(at).addScaledVector(jitter, 2 * spread);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 0.6, 1 + Math.random(), (Math.random() - 0.5) * 0.6);
      this.emit(start, kind, (kind === 'bubble' ? 0.4 : 0.9) * (0.6 + Math.random() * 0.8) * spread, vel, 1.5 + Math.random());
    }
  }

  /** Something got gulped: it swells like a bubble, then pops into little ones. */
  pop(at: THREE.Vector3, radius: number) {
    this.emit(at, 'bubble', radius * 1.6, new THREE.Vector3(), 0.45, radius * 2);
    const vel = new THREE.Vector3();
    for (let i = 0; i < 14; i++) {
      vel.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 2);
      this.emit(at, 'bubble', 0.3 + Math.random() * 0.5 * Math.max(1, radius * 0.4), vel, 0.8 + Math.random() * 0.6);
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      if (p.grow) p.sprite.scale.addScalar(p.grow * dt);
      p.sprite.material.opacity = Math.min(1, p.life);
      if (p.life <= 0) p.sprite.visible = false;
    }
  }
}
