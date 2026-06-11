import { hasSimli, env } from "@/services/env";
import { ServiceUnavailableError } from "@/services/runtime";
import { errorResponse } from "@/services/http";

export const maxDuration = 30;

const SIMLI_BASE = "https://api.simli.ai";

/**
 * Mint a Simli session token + ICE servers server-side (keeps SIMLI_API_KEY off the
 * client). Calls Simli's REST directly to avoid importing the browser/LiveKit SDK
 * server-side. The browser then constructs the SimliClient with these.
 */
export async function POST() {
  try {
    if (!hasSimli) {
      throw new ServiceUnavailableError("Simli is not configured (need SIMLI_API_KEY + SIMLI_FACE_ID).");
    }
    const headers = { "Content-Type": "application/json", "x-simli-api-key": env.SIMLI_API_KEY! };

    const tokenRes = await fetch(`${SIMLI_BASE}/compose/token`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        faceId: env.SIMLI_FACE_ID!,
        handleSilence: true,
        maxSessionLength: 1800,
        maxIdleTime: 300,
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`Simli token failed (${tokenRes.status}): ${await tokenRes.text().catch(() => "")}`);
    }
    const { session_token: sessionToken } = (await tokenRes.json()) as { session_token: string };

    let iceServers: unknown = null;
    const iceRes = await fetch(`${SIMLI_BASE}/compose/ice`, { method: "GET", headers });
    if (iceRes.ok) iceServers = await iceRes.json();

    return Response.json({ sessionToken, iceServers });
  } catch (err) {
    return errorResponse(err);
  }
}
