export type GateView = "app" | "landing";

/** Decide what a visitor sees: the app (keyless/demo or signed-in) or the landing (signed-out). */
export function gateView(isConfigured: boolean, token: string | null): GateView {
  if (!isConfigured) return "app";
  return token ? "app" : "landing";
}
