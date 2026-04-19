let _ctx: AudioContext | null = null;
let _gestureReceived = false;

/**
 * Call this once from a confirmed user gesture (e.g. a button click).
 * Creates/resumes the AudioContext so subsequent sounds can play on mobile browsers.
 */
export function initAudioContext(): void {
  _gestureReceived = true;
  if (_ctx) {
    if (_ctx.state === "suspended") {
      _ctx.resume().catch(() => {});
    }
    return;
  }
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext);
    _ctx = new AC();
  } catch {
    // AudioContext not supported
  }
}

function getAudioContext(): AudioContext | null {
  if (!_gestureReceived) return null;
  if (_ctx) {
    if (_ctx.state === "suspended") {
      _ctx.resume().catch(() => {});
    }
    return _ctx;
  }
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext);
    _ctx = new AC();
    return _ctx;
  } catch {
    return null;
  }
}

export function playQuestComplete() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.1);
    gain.gain.setValueAtTime(0, now + i * 0.1);
    gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.35);
  });
}

export function playLevelUp() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const freqs = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = i < 3 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.08);
    gain.gain.setValueAtTime(0, now + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.55);
  });
}

export function playAriseClick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.3);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc.start(now);
  osc.stop(now + 0.45);
}

export function playBossVictory() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const pairs: [number, number][] = [
    [130.81, now],
    [164.81, now + 0.12],
    [196.0, now + 0.24],
    [261.63, now + 0.36],
    [329.63, now + 0.5],
    [392.0, now + 0.66],
    [523.25, now + 0.84],
  ];
  pairs.forEach(([freq, t]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}

export function playGoldSpend() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 6; i++) {
    const freq = 880 + Math.random() * 440;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.05);
    gain.gain.setValueAtTime(0, now + i * 0.05);
    gain.gain.linearRampToValueAtTime(0.1, now + i * 0.05 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.18);
    osc.start(now + i * 0.05);
    osc.stop(now + i * 0.05 + 0.2);
  }
}

export function playStreakMilestone() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const freqs = [440, 554.37, 659.25, 880, 1108.73];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + i * 0.1);
    gain.gain.setValueAtTime(0, now + i * 0.1);
    gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.45);
  });
}

export function playSystemWarning() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const pulses: [number, number][] = [
    [880, now],
    [660, now + 0.18],
    [880, now + 0.36],
    [440, now + 0.54],
  ];
  pulses.forEach(([freq, t]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.18);
  });
}

export function playRankUp() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.setValueAtTime(660, now + 0.2);
  osc.frequency.setValueAtTime(880, now + 0.4);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  osc.start(now);
  osc.stop(now + 0.75);
}
