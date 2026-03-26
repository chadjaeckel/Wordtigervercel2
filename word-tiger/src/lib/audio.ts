/**
 * Synthesises a short tiger roar using the Web Audio API.
 * No external audio file is needed.
 */
export function playTigerRoar(): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx() as AudioContext;
    const now = ctx.currentTime;
    const roarDuration = 1.8; // seconds

    // ── NOISE LAYER ─────────────────────────────────────────────────────────
    // Shaped noise gives the raw, airy texture of a roar.
    const bufSize = Math.ceil(ctx.sampleRate * roarDuration);
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;

    // Low-pass filter sweeps down to give the roar a "dying" quality
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(600, now);
    lpf.frequency.exponentialRampToValueAtTime(200, now + roarDuration);
    lpf.Q.value = 2.5;

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0, now);
    noiseEnv.gain.linearRampToValueAtTime(0.9, now + 0.1);   // quick attack
    noiseEnv.gain.setValueAtTime(0.9, now + 1.0);             // hold
    noiseEnv.gain.linearRampToValueAtTime(0, now + roarDuration); // release

    noiseSource.connect(lpf);
    lpf.connect(noiseEnv);

    // ── FUNDAMENTAL OSCILLATOR ───────────────────────────────────────────────
    // Sawtooth drops from ~115 Hz to ~50 Hz — a falling growl pitch.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + roarDuration);

    const oscEnv = ctx.createGain();
    oscEnv.gain.setValueAtTime(0, now);
    oscEnv.gain.linearRampToValueAtTime(0.55, now + 0.08);
    oscEnv.gain.setValueAtTime(0.55, now + 1.1);
    oscEnv.gain.linearRampToValueAtTime(0, now + roarDuration);

    osc.connect(oscEnv);

    // ── SUB RUMBLE ───────────────────────────────────────────────────────────
    // A second, lower oscillator for the chest-thumping sub-bass.
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(70, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + roarDuration);

    const subEnv = ctx.createGain();
    subEnv.gain.setValueAtTime(0, now);
    subEnv.gain.linearRampToValueAtTime(0.4, now + 0.15);
    subEnv.gain.setValueAtTime(0.4, now + 0.9);
    subEnv.gain.linearRampToValueAtTime(0, now + roarDuration);

    sub.connect(subEnv);

    // ── MIX → SOFT SATURATION → OUTPUT ───────────────────────────────────────
    const mix = ctx.createGain();
    mix.gain.value = 1;
    noiseEnv.connect(mix);
    oscEnv.connect(mix);
    subEnv.connect(mix);

    // Tanh waveshaper adds warmth / harmonic richness without hard clipping
    const ws = ctx.createWaveShaper();
    const wsCurve = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const x = (i / 256) - 1;
      wsCurve[i] = Math.tanh(3 * x);
    }
    ws.curve = wsCurve;

    const master = ctx.createGain();
    master.gain.value = 0.55; // keep it audible but not jarring

    mix.connect(ws);
    ws.connect(master);
    master.connect(ctx.destination);

    // ── START / STOP ─────────────────────────────────────────────────────────
    noiseSource.start(now);
    noiseSource.stop(now + roarDuration + 0.05);
    osc.start(now);
    osc.stop(now + roarDuration + 0.05);
    sub.start(now);
    sub.stop(now + roarDuration + 0.05);

    // Clean up the AudioContext when done
    setTimeout(() => ctx.close(), (roarDuration + 1) * 1000);
  } catch (e) {
    console.warn('Tiger roar audio unavailable', e);
  }
}
