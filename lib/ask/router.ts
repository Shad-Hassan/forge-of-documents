// Zero-shot router: decide what a prompt needs before any expensive call.
// 1. Deterministic rules (0 tokens). 2. Only if no rule is confident: Haiku with structured output.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { MODELS } from "../engine/models";
import type { FamilyId } from "../engine/types";

export const RouteSchema = z.object({
  intent: z.enum(["ask", "forge", "lookup", "chat"]),
  family: z.enum(["replycast", "plexio", "warden", "athena"]).nullable(),
  /** 0-3, null when not stated. */
  gen: z.number().int().min(0).max(3).nullable(),
});
export type Route = z.infer<typeof RouteSchema> & { by: "rules" | "haiku"; ms: number };

const FAMILY_RULES: Array<[RegExp, FamilyId]> = [
  [/\breply\s?cast\b/i, "replycast"],
  [/\bplexio\b/i, "plexio"],
  [/\bwarden\b(?!\s+(maw|persona|file)\b)/i, "warden"],
  [/\b(athena|bento|command cent(er|re))\b/i, "athena"],
];
const FORGE = /\b(forge|render|turn (this|that|it) into|make (an?|the) (email|page|artifact|doc))\b/i;
const LOOKUP = /^(list|show|open|read|cat)\b|\b[\w.-]+\.(json|html|md|pdf|docx|txt)\b/i;
const CHAT = /^(hi|hey|yo|hello|thanks|thank you|ok|cool)\b[\s!.]*$/i;
const ASK = /^(what|when|where|which|who|why|how|did|does|do|is|are|was|were|find|search|summari[sz]e|compare)\b|\?\s*$/i;
const GEN = /\bgen(?:eration)?\s*([0-3])\b/i;

function rules(q: string): z.infer<typeof RouteSchema> | null {
  const text = q.trim();
  const family = FAMILY_RULES.find(([re]) => re.test(text))?.[1] ?? null;
  const genMatch = text.match(GEN);
  const gen = genMatch ? Number(genMatch[1]) : null;
  if (CHAT.test(text)) return { intent: "chat", family: null, gen: null };
  if (FORGE.test(text)) return { intent: "forge", family, gen };
  if (LOOKUP.test(text)) return { intent: "lookup", family, gen };
  if (ASK.test(text)) return { intent: "ask", family, gen };
  return null; // ambiguous: let the classifier decide
}

const ROUTER_SYSTEM = `Classify a request to a personal document engine that searches a local artifact library and renders documents.
intent: "ask" = needs searching the library to answer; "lookup" = open, list or read a specific file or folder; "forge" = produce or render a document/email/page; "chat" = conversational, needs no library.
family: "replycast" (email replies), "plexio" (notes, reports, emails), "warden" (internal briefs, cosmic pages), "athena" (bento command-center pages, Gen 3), or null if not stated or implied.
gen: artifact generation 0-3 if stated, else null.`;

export async function classify(question: string, client = new Anthropic()): Promise<Route> {
  const t0 = Date.now();
  const fast = rules(question);
  if (fast) return { ...fast, by: "rules", ms: Date.now() - t0 };

  const res = await client.messages.parse({
    model: MODELS.router,
    max_tokens: 1024,
    system: ROUTER_SYSTEM,
    messages: [{ role: "user", content: question.slice(0, 4000) }],
    output_config: { effort: "low", format: zodOutputFormat(RouteSchema) },
  });
  const parsed = res.parsed_output ?? { intent: "ask" as const, family: null, gen: null };
  return { ...parsed, by: "haiku", ms: Date.now() - t0 };
}

/** Exported for tests: the 0-token path alone. */
export const routeByRules = rules;
