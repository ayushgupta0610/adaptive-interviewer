import { describe, it, expect } from "vitest";
import { extractJson } from "./json";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses ```json fenced output", () => {
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it("parses JSON embedded in surrounding prose", () => {
    expect(extractJson('Here is your plan:\n{"a":3}\nThanks!')).toEqual({ a: 3 });
  });

  it("throws on non-JSON", () => {
    expect(() => extractJson("not json at all")).toThrow();
  });
});
