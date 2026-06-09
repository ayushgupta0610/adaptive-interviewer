/**
 * Best-effort JSON extraction from an LLM completion: tolerates ```json fences and
 * surrounding prose by slicing the outermost braces. Throws if no valid JSON is found.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fence ? fence[1] : trimmed).trim();
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  const candidate = first >= 0 && last > first ? body.slice(first, last + 1) : body;
  return JSON.parse(candidate);
}
