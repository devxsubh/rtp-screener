import { WatchmanUnavailableError } from "../screening/watchman";

/** Map provider and infra errors to user-readable messages. */
export function friendlyLlmError(err: unknown): string {
  if (err instanceof WatchmanUnavailableError) {
    return err.message;
  }

  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Request failed";

  if (
    msg.includes("authentication_error") ||
    msg.includes("invalid x-api-key") ||
    msg.includes("401")
  ) {
    return "Anthropic API key is invalid. Set ANTHROPIC_API_KEY in root `.env` (or `.env.production` on EC2) and restart the backend.";
  }

  if (msg.includes("rate_limit") || msg.includes("429")) {
    return "AI rate limit reached. Wait a moment and try again.";
  }

  if (msg.includes("overloaded") || msg.includes("529")) {
    return "AI service is temporarily overloaded. Try again shortly.";
  }

  if (msg.includes("ANTHROPIC_API_KEY is not set")) {
    return "Anthropic API key is not configured on the server.";
  }

  if (msg.includes("ECONNREFUSED") && msg.includes("8084")) {
    return "Watchman sanctions service is not running. Local dev: docker compose -f docker-compose.dev.yml up";
  }

  return msg;
}
