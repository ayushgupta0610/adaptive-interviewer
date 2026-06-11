import { describe, it, expect } from "vitest";
import { canStartSession } from "./entitlement";

const base = { freeTrialUsed: false, subscription: null, paidSessionsThisPeriod: 0, freeTextToday: 0, freeTextDailyCap: 5 };

describe("canStartSession", () => {
  it("allows free text within the daily cap", () => {
    expect(canStartSession({ ...base, mode: "text", freeTextToday: 2 })).toEqual({ allowed: true, reason: "ok", consume: "free_text" });
  });
  it("blocks free text over the daily cap", () => {
    expect(canStartSession({ ...base, mode: "text", freeTextToday: 5 }).allowed).toBe(false);
  });
  it("gives a new user one free voice trial", () => {
    expect(canStartSession({ ...base, mode: "voice" })).toEqual({ allowed: true, reason: "ok", consume: "free_trial" });
  });
  it("blocks voice after trial used with no subscription", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("no_subscription");
  });
  it("allows voice on an active subscription within quota", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true, subscription: { status: "active", quota: 10 }, paidSessionsThisPeriod: 3 });
    expect(r).toEqual({ allowed: true, reason: "ok", consume: "subscription" });
  });
  it("blocks voice when subscription quota is exhausted", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true, subscription: { status: "active", quota: 10 }, paidSessionsThisPeriod: 10 });
    expect(r.reason).toBe("quota_exceeded");
  });
  it("ignores a non-active subscription", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true, subscription: { status: "past_due", quota: 10 }, paidSessionsThisPeriod: 0 });
    expect(r.allowed).toBe(false);
  });
});
