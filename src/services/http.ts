import { ZodError } from "zod";
import { ServiceUnavailableError } from "./runtime";

/** Map thrown errors to clean JSON HTTP responses. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ServiceUnavailableError) {
    return Response.json({ error: err.message }, { status: 503 });
  }
  if (err instanceof ZodError) {
    return Response.json({ error: "Invalid request", details: err.issues }, { status: 400 });
  }
  return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
}
