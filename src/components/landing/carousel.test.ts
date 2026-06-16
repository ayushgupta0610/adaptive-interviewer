import { describe, it, expect } from "vitest";
import { nextIndex, prevIndex } from "./carousel";

describe("carousel index helpers", () => {
  it("nextIndex wraps around", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
  it("prevIndex wraps around", () => {
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(2, 3)).toBe(1);
  });
});
