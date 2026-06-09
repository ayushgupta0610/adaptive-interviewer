import { createHash } from "node:crypto";
import type { Guidelines } from "./schemas";

/**
 * Deterministic, content-addressed key for an interview config. Two configs that
 * are semantically equivalent (same JD, same guidelines regardless of focus-area
 * ordering/casing) produce the same hash, so prepare() can cache the Plan.
 */
export function configHash(jdText: string, guidelines: Guidelines): string {
  const canonical = JSON.stringify({
    jd: jdText.trim(),
    g: {
      type: guidelines.type,
      seniority: guidelines.seniority,
      budget: guidelines.budget,
      focusAreas: [...guidelines.focusAreas].map((s) => s.trim().toLowerCase()).sort(),
    },
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
