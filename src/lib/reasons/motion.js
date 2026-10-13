export function reducedMotion() {
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function easeOut(t) {
  return 1 - (1 - t) ** 3;
}
