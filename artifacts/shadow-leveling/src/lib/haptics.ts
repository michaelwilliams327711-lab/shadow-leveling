export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently ignore — some browsers throw if called without a user gesture.
  }
}

export function hapticTick(): void {
  vibrate(10);
}

export function hapticThud(): void {
  vibrate(50);
}
