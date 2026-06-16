import { vi, describe, it, expect, beforeEach } from "vitest";

/**
 * Unit tests for getUserId — the server-side auth gate. Covers the env-misconfig
 * bypass fix: auth is only skipped when NEITHER the client nor the service Supabase
 * keys are configured (true keyless/demo). If either is present, a valid JWT is
 * required and an unverifiable token resolves to null (401 at the route).
 */

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  state: { client: false, service: false },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("./env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  },
  get hasSupabaseClient() {
    return h.state.client;
  },
  get hasSupabaseService() {
    return h.state.service;
  },
}));

import { getUserId, unauthorized } from "./auth";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://test/api", { headers });
}

beforeEach(() => {
  h.state.client = false;
  h.state.service = false;
  h.getUser.mockReset();
});

describe("getUserId", () => {
  it("returns 'anonymous' in keyless/demo mode (no Supabase configured)", async () => {
    expect(await getUserId(req())).toBe("anonymous");
    expect(h.getUser).not.toHaveBeenCalled();
  });

  it("requires a token once configured — returns null with no Authorization header", async () => {
    h.state.client = true;
    expect(await getUserId(req())).toBeNull();
  });

  it("does not bypass auth when only the service key is set (env-misconfig guard)", async () => {
    h.state.service = true; // client flag false, but auth must still be enforced
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad jwt" } });
    expect(await getUserId(req({ authorization: "Bearer bad" }))).toBeNull();
  });

  it("returns null when the token is rejected by Supabase", async () => {
    h.state.client = true;
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    expect(await getUserId(req({ authorization: "Bearer nope" }))).toBeNull();
  });

  it("returns the verified user id for a valid bearer token", async () => {
    h.state.client = true;
    h.getUser.mockResolvedValue({ data: { user: { id: "user_123" } }, error: null });
    expect(await getUserId(req({ authorization: "Bearer good" }))).toBe("user_123");
  });

  it("parses the Bearer scheme case-insensitively and passes the raw token through", async () => {
    h.state.client = true;
    h.getUser.mockResolvedValue({ data: { user: { id: "user_123" } }, error: null });
    await getUserId(req({ authorization: "bearer RAWtoken" }));
    expect(h.getUser).toHaveBeenCalledWith("RAWtoken");
  });

  it("returns null for a non-Bearer Authorization header", async () => {
    h.state.client = true;
    expect(await getUserId(req({ authorization: "Basic abc" }))).toBeNull();
    expect(h.getUser).not.toHaveBeenCalled();
  });
});

describe("unauthorized", () => {
  it("returns a 401 JSON response", async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in required." });
  });
});
