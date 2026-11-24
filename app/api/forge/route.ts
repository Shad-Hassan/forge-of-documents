import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { forge } from "@/lib/forge/forge";
import { FAMILIES } from "@/lib/families";
import type { FamilyId, Gen } from "@/lib/engine/types";

const client = new Anthropic();

const KNOWN_ERRORS: Record<string, number> = {
  REFUSED: 422,
  TRUNCATED: 502,
  PARSE_FAILED: 502,
  CLI_FAILED: 502,
};

export async function POST(request: NextRequest) {
  let body: { content?: unknown; family?: unknown; title?: unknown; gen?: unknown; direction?: unknown; question?: unknown; citations?: unknown; audience?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const family = body.family as FamilyId;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 140) : "Forged artifact";
  const gen = typeof body.gen === "number" && [0, 1, 2, 3].includes(body.gen) ? (body.gen as Gen) : undefined;
  const direction = typeof body.direction === "string" ? body.direction.slice(0, 1000) : undefined;
  const question = typeof body.question === "string" ? body.question.slice(0, 4000) : undefined;
  const audience = body.audience === "client-facing" ? "client-facing" : "internal";
  const citations = Array.isArray(body.citations)
    ? body.citations
        .filter((c): c is { source: string; title: string | null; cited_text: string } => !!c && typeof c === "object" && typeof (c as { source?: unknown }).source === "string")
        .slice(0, 50)
        .map((c) => ({ source: c.source, title: typeof c.title === "string" ? c.title : null, cited_text: String(c.cited_text ?? "").slice(0, 2000) }))
    : undefined;

  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });
  if (!(family in FAMILIES)) return NextResponse.json({ error: "unknown family" }, { status: 400 });

  try {
    const result = await forge({ content, family, title, gen, direction, question, citations, audience }, client);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = KNOWN_ERRORS[msg.split(":")[0]];
    if (code) return NextResponse.json({ error: msg }, { status: code });
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Authentication failed. Check ANTHROPIC_API_KEY." }, { status: 401 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `API error ${error.status}` }, { status: 502 });
    }
    console.error("forge error:", error);
    return NextResponse.json({ error: "Forge failed" }, { status: 500 });
  }
}
