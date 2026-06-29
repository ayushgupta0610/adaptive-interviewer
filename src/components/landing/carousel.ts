/** Next index with wrap-around. */
export function nextIndex(i: number, len: number): number {
  return (i + 1) % len;
}
/** Previous index with wrap-around. */
export function prevIndex(i: number, len: number): number {
  return (i - 1 + len) % len;
}
