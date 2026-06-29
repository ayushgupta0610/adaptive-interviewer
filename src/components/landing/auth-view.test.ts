import { describe, it, expect } from "vitest";
import { gateView } from "./auth-view";

describe("gateView", () => {
  it("keyless/demo mode always shows the app", () => {
    expect(gateView(false, null)).toBe("app");
    expect(gateView(false, "demo")).toBe("app");
  });
  it("configured + no token shows the landing", () => {
    expect(gateView(true, null)).toBe("landing");
  });
  it("configured + token shows the app", () => {
    expect(gateView(true, "jwt")).toBe("app");
  });
});
