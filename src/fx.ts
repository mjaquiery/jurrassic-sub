import * as THREE from 'three';

function emojiTexture(draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d')!);
  return new THREE.CanvasTexture(c);
}

interface Puff {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
}

/** Pooled bubbles and hearts: the "yay" when something is tapped or bumped. */
export class Fx {
  private pool: Puff[] = [];
  private mats: Record<'bubble' | 'heart', THREE.SpriteMaterial>;

  constructor(scene: THREE.Scene, size = 80) {
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
    const heart = emojiTexture((g) => {
      g.font = '48px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('💖', 32, 36);
    });
    this.mats = {
      bubble: new THREE.SpriteMaterial({ map: bubble, transparent: true, depthWrite: false }),
      heart: new THREE.SpriteMaterial({ map: heart, transparent: true, depthWrite: false }),
    };
    for (let i = 0; i < size; i++) {
      const sprite = new THREE.Sprite(this.mats.bubble);
      sprite.visible = false;
      scene.add(sprite);
      this.pool.push({ sprite, vel: new THREE.Vector3(), life: 0 });
    }
  }

  burst(at: THREE.Vector3, n: number, kind: 'bubble' | 'heart', spread = 1) {
    for (let i = 0; i < n; i++) {
      const p = this.pool.find((q) => q.life <= 0);
      if (!p) return;
      p.life = 1.5 + Math.random();
      p.sprite.material = this.mats[kind];
      p.sprite.position.copy(at).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * spread));
      p.sprite.scale.setScalar((kind === 'heart' ? 0.9 : 0.4) * (0.6 + Math.random() * 0.8) * spread);
      p.vel.set((Math.random() - 0.5) * 0.6, 1 + Math.random(), (Math.random() - 0.5) * 0.6);
      p.sprite.visible = true;
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.material.opacity = Math.min(1, p.life);
      if (p.life <= 0) p.sprite.visible = false;
    }
  }
}
