import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Live RLS scoping test. Skipped unless Supabase keys are present so the suite stays
 * green offline. When keys + the 0001 migration + Anonymous Auth are in place, this
 * proves RLS actually isolates candidates (not just app logic).
 *
 * Requires: project has Anonymous Sign-ins enabled and migration 0001 applied.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ready = !!url && !!anon;

describe.skipIf(!ready)("RLS scoping (live Supabase)", () => {
  it("a candidate cannot read another candidate's row", async () => {
    const a = createClient(url!, anon!);
    const b = createClient(url!, anon!);

    const { data: au, error: ae } = await a.auth.signInAnonymously();
    const { data: bu, error: be } = await b.auth.signInAnonymously();
    expect(ae).toBeNull();
    expect(be).toBeNull();
    const aId = au.user!.id;
    const bId = bu.user!.id;

    // Each candidate creates their own row (allowed by candidates_self).
    expect((await a.from("candidates").upsert({ id: aId }).select()).error).toBeNull();
    expect((await b.from("candidates").upsert({ id: bId }).select()).error).toBeNull();

    // B tries to read A's row — RLS must filter it out (0 rows, no error).
    const { data: leaked } = await b.from("candidates").select("id").eq("id", aId);
    expect(leaked ?? []).toHaveLength(0);

    // Sanity: B can read its own row.
    const { data: own } = await b.from("candidates").select("id").eq("id", bId);
    expect(own).toHaveLength(1);
  });
});
