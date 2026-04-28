let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function triggerBoom(volume: number = 1): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const v = Math.max(0, Math.min(1, volume));
    if (v <= 0) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.9 * v, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    master.connect(ctx.destination);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.45);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.85, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    sub.connect(subGain).connect(master);
    sub.start(now);
    sub.stop(now + 0.55);

    const noiseDuration = 0.18;
    const noiseBuffer = ctx.createBuffer(
      1,
      Math.max(1, Math.floor(ctx.sampleRate * noiseDuration)),
      ctx.sampleRate
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * (1 - t);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(900, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.15);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + noiseDuration);
  } catch {
    // Ignore — older browsers or autoplay policies can throw before user gesture.
  }
}

/**
 * Glass-shatter SFX for the moment a habit fractures.
 * Pairs a 150ms high-passed white-noise burst with three brittle sine
 * transients (3k/4.5k/6k Hz) routed through a shared master "filter"
 * (high-pass) so it cohabits with triggerBoom's "Concussion" effect.
 */
export function triggerShatter(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // Master output gain + high-pass "masterFilter" — keeps the shatter
    // tonally in the same register as other concussive effects.
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.9, now);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = "highpass";
    masterFilter.frequency.setValueAtTime(2500, now);
    masterFilter.Q.setValueAtTime(0.7, now);

    master.connect(masterFilter).connect(ctx.destination);

    // 1) High-frequency white-noise burst (150ms) through a high-pass @ 2500Hz.
    const noiseDuration = 0.15;
    const noiseBuffer = ctx.createBuffer(
      1,
      Math.max(1, Math.floor(ctx.sampleRate * noiseDuration)),
      ctx.sampleRate
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // Sharp attack, quick decay envelope baked into the noise.
      data[i] = (Math.random() * 2 - 1) * (1 - t);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseHighPass = ctx.createBiquadFilter();
    noiseHighPass.type = "highpass";
    noiseHighPass.frequency.setValueAtTime(2500, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDuration);

    noise.connect(noiseHighPass).connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + noiseDuration);

    // 2) Three glass transients — sine oscillators at 3k/4.5k/6k Hz with
    // near-instant exponential decays of 20ms / 40ms / 60ms.
    const transients: Array<{ freq: number; decay: number; gain: number }> = [
      { freq: 3000, decay: 0.02, gain: 0.5 },
      { freq: 4500, decay: 0.04, gain: 0.4 },
      { freq: 6000, decay: 0.06, gain: 0.3 },
    ];

    transients.forEach(({ freq, decay, gain }, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      const oscGain = ctx.createGain();
      // Slight stagger so the transients sound like separate shards, not a chord.
      const start = now + i * 0.005;
      oscGain.gain.setValueAtTime(gain, start);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, start + decay);

      osc.connect(oscGain).connect(master);
      osc.start(start);
      osc.stop(start + decay + 0.005);
    });
  } catch {
    // Ignore — older browsers or autoplay policies can throw before user gesture.
  }
}

/**
 * High-frequency "Tick" SFX for the Rolling Gold counter — one of these
 * per visible digit increment. Designed to be ~10ms long, very subtle
 * (~0.15 gain), so a fast roll sounds like a coin flurry instead of a
 * cacophony. Sine oscillator at a randomized 5000-6000 Hz with a near-
 * instant attack and an 8ms exponential decay to silence.
 */
export function triggerGoldTick(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Randomize within the 5k-6k band so a fast roll sounds organic
    // (every tick gets a slightly different timbre, like real coins).
    const freq = 5000 + Math.random() * 1000;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    const gain = ctx.createGain();
    // Near-instant attack -> exponential decay to silence within 8ms.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.012);
  } catch {
    // Ignore — older browsers or autoplay policies can throw before user gesture.
  }
}
