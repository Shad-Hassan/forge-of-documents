// Headless Claude Code driver (`claude -p`), authenticated by Shad's own Claude Code login.
// Personal, local use only: never expose this backend to other users.
//
// Isolation (measured 2026-11-24: 17,706 → 603 context tokens):
//   --setting-sources ""  no user/project settings, so no hooks, CLAUDE.md or memory
//   --system-prompt       our prompt replaces Claude Code's
//   --strict-mcp-config   no MCP servers;  --disable-slash-commands  no skills
//   --no-session-persistence  nothing written to ~/.claude/projects
// Tool sandbox: --tools limits the set, --allowedTools pre-approves them, and --permission-mode dontAsk
// denies everything else (e.g. reads outside cwd/--add-dir). --restricted removes code-running tools.
// NOT --bare: it ignores OAuth and needs ANTHROPIC_API_KEY.
import { spawn } from "node:child_process";

export const CLAUDE_BIN = process.env.FORGE_CLAUDE_BIN ?? "/home/shad/.local/bin/claude";

export type CliEvent =
  | { type: "tool"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; isError: boolean; preview: string }
  | { type: "text"; text: string }
  | { type: "thinking" }
  | { type: "result"; result: CliResult };

export interface CliResult {
  ok: boolean;
  subtype: string;
  text: string;
  structured?: unknown;
  turns: number;
  durationMs: number;
  costUsd: number;
  usage?: Record<string, unknown>;
  permissionDenials: unknown[];
  errors?: string[];
}

export interface CliOptions {
  prompt: string;
  systemPrompt: string;
  /** Built-in tools to expose. [] = none (pure generation). */
  tools: string[];
  cwd: string;
  addDirs?: string[];
  model?: string;
  /** JSON Schema for structured output (result arrives as `structured`). */
  jsonSchema?: object;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function buildArgs(o: CliOptions): string[] {
  const args = [
    "-p", o.prompt,
    "--output-format", "stream-json", "--verbose",
    "--system-prompt", o.systemPrompt,
    "--setting-sources", "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--restricted",
    "--permission-mode", "dontAsk",
    "--tools", o.tools.join(","),
  ];
  if (o.tools.length) args.push("--allowedTools", ...o.tools);
  for (const d of o.addDirs ?? []) args.push("--add-dir", d);
  if (o.model) args.push("--model", o.model);
  if (o.jsonSchema) args.push("--json-schema", JSON.stringify(o.jsonSchema));
  return args;
}

/** Runs one headless turn and yields live events, ending with exactly one `result`. */
export async function* runClaude(o: CliOptions): AsyncGenerator<CliEvent> {
  const child = spawn(CLAUDE_BIN, buildArgs(o), {
    cwd: o.cwd,
    env: { ...process.env, ANTHROPIC_API_KEY: "" }, // force the CLI's own login, never a stub key
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group, so Stop kills the CLI and anything it spawned
  });
  const kill = () => {
    try { if (child.pid) process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
  };
  o.signal?.addEventListener("abort", kill, { once: true });
  const timer = setTimeout(kill, o.timeoutMs ?? 300_000);

  let stderr = "";
  child.stderr.on("data", (b) => { stderr = (stderr + b).slice(-4000); });

  const exited = new Promise<number | null>((res) => child.on("close", (code) => res(code)));
  let buf = "";
  let sawResult = false;
  try {
    for await (const chunk of child.stdout) {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let e: any;
        try { e = JSON.parse(line); } catch { continue; }
        if (e.type === "assistant") {
          for (const b of e.message?.content ?? []) {
            if (b.type === "tool_use") yield { type: "tool", name: b.name, input: b.input ?? {} };
            else if (b.type === "text" && b.text) yield { type: "text", text: b.text };
            else if (b.type === "thinking") yield { type: "thinking" };
          }
        } else if (e.type === "user") {
          for (const b of e.message?.content ?? []) {
            if (b?.type === "tool_result") {
              const c = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? "");
              yield { type: "tool_result", isError: !!b.is_error, preview: c.slice(0, 160) };
            }
          }
        } else if (e.type === "result") {
          sawResult = true;
          yield {
            type: "result",
            result: {
              ok: e.subtype === "success" && !e.is_error,
              subtype: e.subtype,
              text: typeof e.result === "string" ? e.result : "",
              structured: e.structured_output,
              turns: e.num_turns ?? 0,
              durationMs: e.duration_ms ?? 0,
              costUsd: e.total_cost_usd ?? 0,
              usage: e.usage,
              permissionDenials: e.permission_denials ?? [],
              errors: e.errors,
            },
          };
        }
      }
    }
    const code = await exited;
    if (!sawResult) {
      yield {
        type: "result",
        result: {
          ok: false, subtype: o.signal?.aborted ? "aborted" : "no_result", text: "",
          turns: 0, durationMs: 0, costUsd: 0, permissionDenials: [],
          errors: [o.signal?.aborted ? "Stopped." : `claude exited ${code}: ${stderr.trim().slice(-400)}`],
        },
      };
    }
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener("abort", kill);
    if (child.exitCode === null) kill();
  }
}

/** Convenience: run to completion and return the result. */
export async function runClaudeOnce(o: CliOptions): Promise<CliResult> {
  let last: CliResult | null = null;
  for await (const e of runClaude(o)) if (e.type === "result") last = e.result;
  return last!;
}
