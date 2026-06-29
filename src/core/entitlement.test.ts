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

describe("canStartSession — edge cases", () => {
  it("blocks free text exactly at the cap boundary", () => {
    const r = canStartSession({ ...base, mode: "text", freeTextToday: 5, freeTextDailyCap: 5 });
    expect(r).toEqual({ allowed: false, reason: "text_daily_cap", consume: "none" });
  });
  it("blocks all free text when the daily cap is zero", () => {
    const r = canStartSession({ ...base, mode: "text", freeTextToday: 0, freeTextDailyCap: 0 });
    expect(r.allowed).toBe(false);
  });
  it("treats a cancelled subscription as no subscription", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true, subscription: { status: "cancelled", quota: 10 } });
    expect(r).toEqual({ allowed: false, reason: "no_subscription", consume: "none" });
  });
  it("treats an expired subscription as no subscription", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true, subscription: { status: "expired", quota: 10 } });
    expect(r.reason).toBe("no_subscription");
  });
  it("falls back to the free trial when the subscription is non-active and the trial is unused", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: false, subscription: { status: "past_due", quota: 10 } });
    expect(r).toEqual({ allowed: true, reason: "ok", consume: "free_trial" });
  });
  it("blocks voice on an active subscription whose quota is zero", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true, subscription: { status: "active", quota: 0 } });
    expect(r.reason).toBe("quota_exceeded");
  });
  it("allows free text even when voice entitlement is fully exhausted", () => {
    const r = canStartSession({ ...base, mode: "text", freeTrialUsed: true, subscription: null, freeTextToday: 0 });
    expect(r).toEqual({ allowed: true, reason: "ok", consume: "free_text" });
  });
  it("gives active subscribers unlimited text under a distinct ledger label (bypasses the daily cap)", () => {
    const r = canStartSession({ ...base, mode: "text", freeTextToday: 99, freeTextDailyCap: 5, subscription: { status: "active", quota: 10 } });
    expect(r).toEqual({ allowed: true, reason: "ok", consume: "subscription_text" });
  });
  it("still caps free (no-subscription) users on text", () => {
    const r = canStartSession({ ...base, mode: "text", freeTextToday: 5, freeTextDailyCap: 5, subscription: null });
    expect(r.allowed).toBe(false);
  });
});
