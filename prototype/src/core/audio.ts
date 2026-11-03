/** Procedural wind, bells and a little stone-room reverb. No audio files. */
export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private muted = false;
  private bellTimer = 9;
  private started = false;
  private noiseBuffer: AudioBuffer | null = null;

  start(): void {
    if (this.started) return;
    this.started = true;

    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    this.ctx = ctx;
    void ctx.resume();

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.55;
    master.connect(ctx.destination);
    this.master = master;

    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(ctx, 2.6, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    reverb.connect(wet).connect(master);

    // Wind bed
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last * 6;
    }

    const fxNoise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const fxData = fxNoise.getChannelData(0);
    for (let i = 0; i < fxData.length; i++) fxData[i] = Math.random() * 2 - 1;
    this.noiseBuffer = fxNoise;

    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    lp.Q.value = 0.7;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.055;
    this.windGain = windGain;

    src.connect(lp).connect(windGain).connect(master);
    src.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    // A thin high whistle over the wind.
    const whistle = ctx.createBufferSource();
    whistle.buffer = noise;
    whistle.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 880;
    bp.Q.value = 1.6;
    const whistleGain = ctx.createGain();
    whistleGain.gain.value = 0.008;
    whistle.connect(bp).connect(whistleGain).connect(master);
    whistle.start();

    this.bellTimer = 14;
  }

  private impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buffer;
  }

  private playBell(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    const partials = [
      [196, 0.07],
      [293.66, 0.045],
      [392, 0.03],
      [587.33, 0.018],
      [784, 0.01],
    ] as const;

    for (const [freq, amp] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(amp, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.2);
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + 5.4);
    }
  }

  /** Sword cutting air. */
  swing(power = 1): void {
    const ctx = this.ctx;
    const master = this.master;
    const buffer = this.noiseBuffer;
    if (!ctx || !master || !buffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(1700, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12 * power, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    src.connect(filter).connect(gain).connect(master);
    src.start(now);
    src.stop(now + 0.26);
  }

  /** Metal / wood impact. */
  hit(heavy = false): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(heavy ? 120 : 90, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 38 : 48, now + 0.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(heavy ? 0.3 : 0.18, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.34);

    const buffer = this.noiseBuffer;
    if (buffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.12, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      noise.connect(hp).connect(ng).connect(master);
      noise.start(now);
      noise.stop(now + 0.14);
    }
  }

  dodge(): void {
    const ctx = this.ctx;
    const master = this.master;
    const buffer = this.noiseBuffer;
    if (!ctx || !master || !buffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    src.connect(filter).connect(gain).connect(master);
    src.start(now);
    src.stop(now + 0.22);
  }

  hurt(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.24);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  execute(): void {
    this.swing(1.4);
    this.hit(true);
    this.playBell();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.08);
    }
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.08);
    }
  }

  update(dt: number, night: number): void {
    if (!this.ctx || !this.windGain) return;
    this.windGain.gain.setTargetAtTime(0.05 - night * 0.018, this.ctx.currentTime, 0.6);
    this.bellTimer -= dt;
    if (this.bellTimer <= 0) {
      this.bellTimer = 26 + Math.random() * 26;
      this.playBell();
    }
  }
}
