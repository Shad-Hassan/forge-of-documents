// GET /api/docs: every document, newest first.
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { listDocs } from "@/lib/docs/store";

export async function GET() {
  await connection(); // cacheComponents: never prerender a live listing
  return NextResponse.json({ docs: listDocs() });
}
