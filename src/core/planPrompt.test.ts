import { describe, it, expect } from "vitest";
import { buildPlanMessages } from "./planPrompt";
import type { Guidelines } from "../domain/schemas";

const g: Guidelines = {
  type: "system-design",
  seniority: "senior",
  budget: { kind: "questions", count: 4 },
  focusAreas: ["scalability", "data modeling"],
};

describe("buildPlanMessages", () => {
  const msgs = buildPlanMessages("We need a senior engineer to build payment systems.", g);

  it("returns a system message then a user message", () => {
    expect(msgs.map((m) => m.role)).toEqual(["system", "user"]);
  });

  it("instructs strict JSON output matching the plan shape", () => {
    const sys = msgs[0].content.toLowerCase();
    expect(sys).toContain("json");
    expect(sys).toContain("competenc");
    expect(sys).toContain("rubric");
  });

  it("includes the JD, seniority, type, focus areas and budget in the user message", () => {
    const user = msgs[1].content;
    expect(user).toContain("payment systems");
    expect(user).toContain("senior");
    expect(user).toContain("system-design");
    expect(user).toContain("scalability");
    expect(user).toContain("data modeling");
    expect(user.toLowerCase()).toContain("4");
  });
});
