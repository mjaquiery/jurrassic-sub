import type { VoiceKind } from './species';

interface Tone {
  type: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  vol: number;
  lowpass?: number;
  vibrato?: number;
  tremolo?: number;
  delay?: number;
}

// C lydian-ish chords for the ambient pad, and a pentatonic for music-box notes.
const CHORDS = [
  [130.8, 164.8, 196, 246.9],
  [110, 130.8, 164.8, 196],
  [87.3, 110, 130.8, 164.8],
  [98, 123.5, 146.8, 185],
];
const PENTA = [523.3, 587.3, 659.3, 784, 880, 1046.5];

/** Everything is synthesised with WebAudio: no files, no licences. */
export class Sound {
  private ctx?: AudioContext;
  private master!: GainNode;
  private hum!: GainNode;
  private prop!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private muted = false;
  private chord = 0;
  private nextChord = 0;
  private nextNote = 0;
  private nextPing = 0;
  private nextBubble = 0;

  /** Must be called from a user gesture (iOS only unlocks audio then). */
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = (this.ctx = new Ctor());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);

    // Sub engine: low hum plus a soft propeller whoosh, both follow speed.
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 52;
    const humLp = ctx.createBiquadFilter();
    humLp.frequency.value = 160;
    this.hum = ctx.createGain();
    this.hum.gain.value = 0.015;
    hum.connect(humLp).connect(this.hum).connect(this.master);
    hum.start();

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    this.prop = ctx.createGain();
    this.prop.gain.value = 0;
    src.connect(bp).connect(this.prop).connect(this.master);
    src.start();

    // Music bus: quiet, with a soft echo.
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.5;
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.45;
    const fb = ctx.createGain();
    fb.gain.value = 0.4;
    echo.connect(fb).connect(echo);
    this.musicBus.connect(this.master);
    this.musicBus.connect(echo);
    echo.connect(this.master);
    this.nextChord = ctx.currentTime + 0.1;
    this.nextNote = ctx.currentTime + 4;
    this.nextPing = ctx.currentTime + 3;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }
  get isMuted() {
    return this.muted;
  }

  pause(p: boolean) {
    if (!this.ctx) return;
    void (p ? this.ctx.suspend() : this.ctx.resume());
  }

  /** Called every frame; `speed01` is 0 when drifting, 1 at full thrust. */
  update(speed01: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.hum.gain.setTargetAtTime(0.015 + speed01 * 0.035, now, 0.1);
    this.prop.gain.setTargetAtTime(speed01 * 0.05, now, 0.1);
    if (now > this.nextChord) {
      this.padChord(CHORDS[this.chord++ % CHORDS.length], now);
      this.nextChord = now + 8;
    }
    if (now > this.nextNote) {
      this.note(PENTA[Math.floor(Math.random() * PENTA.length)], now);
      this.nextNote = now + 2 + Math.random() * 3;
    }
    if (now > this.nextPing) {
      this.tone({ type: 'sine', f0: 1500, dur: 1.6, vol: 0.025 });
      this.nextPing = now + 8 + Math.random() * 6;
    }
    if (speed01 > 0.3 && now > this.nextBubble) {
      this.bubble();
      this.nextBubble = now + 0.25 + Math.random() * 0.6;
    }
  }

  private padChord(freqs: number[], t: number) {
    const ctx = this.ctx!;
    for (const f of freqs) {
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.018, t + 3);
        g.gain.linearRampToValueAtTime(0, t + 9);
        const lp = ctx.createBiquadFilter();
        lp.frequency.value = 900;
        o.connect(lp).connect(g).connect(this.musicBus);
        o.start(t);
        o.stop(t + 9.2);
      }
    }
  }

  private note(f: number, t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 1.8);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 2);
  }

  private bubble() {
    const f = 300 + Math.random() * 500;
    this.tone({ type: 'sine', f0: f, f1: f * 1.8, dur: 0.1, vol: 0.05 });
  }

  /** Happy two-note chime when a creature is identified. */
  chime() {
    this.tone({ type: 'sine', f0: 660, dur: 0.5, vol: 0.09 });
    this.tone({ type: 'sine', f0: 990, dur: 0.7, vol: 0.08, delay: 0.12 });
  }

  /** Soft thump when the sub bumps something. */
  bump() {
    this.tone({ type: 'sine', f0: 140, f1: 60, dur: 0.25, vol: 0.16 });
  }

  /** Cartoon gulp: two quick swallows. */
  gulp() {
    this.tone({ type: 'sine', f0: 420, f1: 120, dur: 0.18, vol: 0.2 });
    this.tone({ type: 'sine', f0: 320, f1: 90, dur: 0.16, vol: 0.18, delay: 0.16 });
  }

  /** Bubble popping. */
  pop() {
    this.tone({ type: 'triangle', f0: 1500, f1: 300, dur: 0.07, vol: 0.2, delay: 0.1 });
  }

  voice(kind: VoiceKind, base: number) {
    switch (kind) {
      case 'whistle':
        this.tone({ type: 'sine', f0: base, f1: base * 1.7, dur: 0.22, vol: 0.12 });
        this.tone({ type: 'sine', f0: base * 1.7, f1: base * 1.1, dur: 0.25, vol: 0.12, delay: 0.25 });
        break;
      case 'honk':
        this.tone({ type: 'triangle', f0: base, f1: base * 0.8, dur: 0.45, vol: 0.18, vibrato: 7, lowpass: 1200 });
        break;
      case 'rumble':
        this.tone({ type: 'sawtooth', f0: base, f1: base * 0.75, dur: 0.8, vol: 0.2, lowpass: 280, vibrato: 4 });
        break;
      case 'croak':
        this.tone({ type: 'square', f0: base, f1: base * 0.8, dur: 0.4, vol: 0.1, lowpass: 600, tremolo: 28 });
        break;
      case 'whoop':
        this.tone({ type: 'sine', f0: base, f1: base * 1.6, dur: 0.6, vol: 0.25 });
        this.tone({ type: 'sine', f0: base * 1.6, f1: base * 0.8, dur: 0.8, vol: 0.25, delay: 0.55 });
        break;
      case 'blip':
        this.tone({ type: 'sine', f0: base, f1: base * 1.5, dur: 0.08, vol: 0.12 });
        this.tone({ type: 'sine', f0: base * 1.2, f1: base * 1.8, dur: 0.08, vol: 0.12, delay: 0.1 });
        break;
      case 'pop':
        this.tone({ type: 'sine', f0: base, f1: base * 0.3, dur: 0.12, vol: 0.18 });
        break;
    }
  }

  private tone(t: Tone) {
    const ctx = this.ctx;
    if (!ctx) return;
    const start = ctx.currentTime + (t.delay ?? 0);
    const o = ctx.createOscillator();
    o.type = t.type;
    o.frequency.setValueAtTime(t.f0, start);
    if (t.f1) o.frequency.exponentialRampToValueAtTime(t.f1, start + t.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(t.vol, start + Math.min(0.05, t.dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0005, start + t.dur);
    let node: AudioNode = o;
    if (t.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.frequency.value = t.lowpass;
      node = node.connect(lp);
    }
    node.connect(g).connect(this.master);
    if (t.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = t.vibrato;
      const depth = ctx.createGain();
      depth.gain.value = t.f0 * 0.03;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(start);
      lfo.stop(start + t.dur + 0.05);
    }
    if (t.tremolo) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = t.tremolo;
      const depth = ctx.createGain();
      depth.gain.value = t.vol * 0.4;
      lfo.connect(depth).connect(g.gain);
      lfo.start(start);
      lfo.stop(start + t.dur + 0.05);
    }
    o.start(start);
    o.stop(start + t.dur + 0.05);
  }
}
