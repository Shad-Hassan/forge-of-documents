// Backend switch. FORGE_BACKEND = "api" | "cli" | "auto" (default).
//   api  Anthropic API (needs a real ANTHROPIC_API_KEY, pay-as-you-go credits)
//   cli  headless Claude Code on Shad's own login (personal, local use only)
//   auto api when the key looks real, else cli
import { existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CLAUDE_BIN, runClaudeOnce } from "../cli/claude";
import { MODELS } from "./models";
import os from "node:os";

export type Backend = "api" | "cli";

export function apiKeyLooksReal(): boolean {
  const k = process.env.ANTHROPIC_API_KEY ?? "";
  return k.startsWith("sk-ant-") && k.length >= 40 && !k.includes("...");
}

export function backend(): Backend {
  const want = (process.env.FORGE_BACKEND ?? "auto").toLowerCase();
  if (want === "api" || want === "cli") return want;
  return apiKeyLooksReal() ? "api" : "cli";
}

export function backendStatus() {
  return { backend: backend(), apiKey: apiKeyLooksReal(), cli: existsSync(CLAUDE_BIN) };
}

export interface StructuredResult<T> {
  data: T;
  usage: { input_tokens: number; output_tokens: number; cost_usd?: number };
  backend: Backend;
}

/** One structured generation (forge, revise) on whichever backend is active. No tools. */
export async function generateStructured<S extends z.ZodTypeAny>(opts: {
  system: string;
  user: string;
  schema: S;
  client?: Anthropic;
}): Promise<StructuredResult<z.infer<S>>> {
  if (backend() === "api") {
    const client = opts.client ?? new Anthropic();
    const res = await client.messages.parse({
      model: MODELS.main,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(opts.schema) },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    if (res.stop_reason === "refusal") throw new Error("REFUSED");
    if (res.stop_reason === "max_tokens") throw new Error("TRUNCATED");
    if (!res.parsed_output) throw new Error("PARSE_FAILED");
    return { data: res.parsed_output, usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens }, backend: "api" };
  }

  const r = await runClaudeOnce({
    prompt: opts.user,
    systemPrompt: opts.system,
    tools: [],
    cwd: os.tmpdir(), // no tools, so the folder only anchors the process
    model: MODELS.main,
    jsonSchema: z.toJSONSchema(opts.schema, { target: "draft-7" }) as object,
  });
  if (!r.ok) throw new Error(r.subtype === "error_max_structured_output_retries" ? "PARSE_FAILED" : `CLI_FAILED:${(r.errors ?? []).join("; ").slice(0, 200)}`);
  const parsed = opts.schema.safeParse(r.structured);
  if (!parsed.success) throw new Error("PARSE_FAILED");
  const u = (r.usage ?? {}) as Record<string, number>;
  return { data: parsed.data, usage: { input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, cost_usd: r.costUsd }, backend: "cli" };
}
