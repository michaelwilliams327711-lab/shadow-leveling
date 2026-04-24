function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently ignore — some browsers throw if called without a user gesture.
  }
}

export function triggerHapticTick(): void {
  vibrate(10);
}

export function triggerHapticThud(): void {
  vibrate(50);
}
