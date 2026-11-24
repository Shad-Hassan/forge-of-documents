import type { AnthropicBeta } from "@anthropic-ai/sdk/resources/beta/beta";

// One place for model IDs. Exact IDs, no date suffixes.
export const MODELS = {
  /** Answers, search loop, forge renders. */
  main: "claude-opus-5-5",
  /** Zero-shot router for prompts the rule fast path can't settle. */
  router: "claude-haiku-5-5",
} as const;

/** Server-side refusal fallback (opt-in, routes by refusal category). Spread into beta requests. */
export function fallback(): { betas: AnthropicBeta[]; fallbacks: "default" } {
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}
