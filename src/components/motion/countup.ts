/** Eased value at progress t∈[0,1] toward target, using easeOutCubic. Clamps t. */
export function easeOutValue(t: number, target: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const eased = 1 - Math.pow(1 - clamped, 3);
  return eased * target;
}
