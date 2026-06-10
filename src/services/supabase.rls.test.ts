import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Live RLS scoping test (spec §9). Skipped unless Supabase URL + anon key + service
 * role key are present, so the suite stays green offline. Creates two real users via
 * the admin API (no dependency on the anonymous-auth toggle), then proves RLS isolates
 * candidates and rejects forged rows. Cleans up the users afterward.
 *
 * Run:  NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *         SUPABASE_SERVICE_ROLE_KEY=... npx vitest run src/services/supabase.rls.test.ts
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ready = !!url && !!anon && !!service;

describe.skipIf(!ready)("RLS scoping (live Supabase)", () => {
  it("isolates candidates and rejects forged rows", { timeout: 60_000 }, async () => {
    const admin = createClient(url!, service!, { auth: { persistSession: false, autoRefreshToken: false } });
    const password = `Test_${Date.now()}_aA1!`;
    const emailA = `rlstest_a_${Date.now()}@example.com`;
    const emailB = `rlstest_b_${Date.now()}_b@example.com`;

    const a = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    const b = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    const aId = a.data.user!.id;
    const bId = b.data.user!.id;

    try {
      const ca = createClient(url!, anon!, { auth: { persistSession: false } });
      const cb = createClient(url!, anon!, { auth: { persistSession: false } });
      await ca.auth.signInWithPassword({ email: emailA, password });
      await cb.auth.signInWithPassword({ email: emailB, password });

      // Each candidate creates their own row (allowed by candidates_self).
      expect((await ca.from("candidates").upsert({ id: aId }).select()).error).toBeNull();
      expect((await cb.from("candidates").upsert({ id: bId }).select()).error).toBeNull();

      // B cannot read A's row — RLS filters it (0 rows, no error).
      const leaked = await cb.from("candidates").select("id").eq("id", aId);
      expect(leaked.data ?? []).toHaveLength(0);

      // B can read its own row.
      const own = await cb.from("candidates").select("id").eq("id", bId);
      expect(own.data).toHaveLength(1);

      // A cannot forge a row owned by B (with check rejects it).
      const forged = await ca.from("candidates").insert({ id: bId });
      expect(forged.error).not.toBeNull();
    } finally {
      await admin.from("candidates").delete().in("id", [aId, bId]);
      await admin.auth.admin.deleteUser(aId);
      await admin.auth.admin.deleteUser(bId);
    }
  });
});
