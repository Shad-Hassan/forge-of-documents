// GET /api/docs/:id[?v=n]  -> { doc, draft } (draft of version n, default latest)
// PUT /api/docs/:id        -> body { draft, note? }: validate, re-render, save as a NEW version. No Claude call.
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDoc, getDraft, saveVersion } from "@/lib/docs/store";

function fail(e: unknown) {
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "INVALID_DRAFT", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "NOT_FOUND") return NextResponse.json({ error: msg }, { status: 404 });
  if (msg === "BAD_ID") return NextResponse.json({ error: msg }, { status: 400 });
  console.error("docs error:", e);
  return NextResponse.json({ error: "Docs request failed" }, { status: 500 });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const vParam = request.nextUrl.searchParams.get("v");
    const v = vParam ? Number(vParam) : undefined;
    return NextResponse.json({ doc: getDoc(id), draft: getDraft(id, v) });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { draft?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.draft === undefined) return NextResponse.json({ error: "draft is required" }, { status: 400 });
  try {
    const note = typeof body.note === "string" ? body.note.slice(0, 300) : undefined;
    const { doc, version } = await saveVersion(id, body.draft, "edit", note);
    return NextResponse.json({ doc, version });
  } catch (e) {
    return fail(e);
  }
}
