// Read-only preview of forged files in data/out. GET ?path=<slug>/<file>
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { OUT_DIR } from "@/lib/search/roots";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".eml": "message/rfc822",
};

export async function GET(request: NextRequest) {
  const rel = request.nextUrl.searchParams.get("path") ?? "";
  if (!rel || rel.includes("\0") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  let abs: string;
  try {
    const root = realpathSync(OUT_DIR);
    // Lexical containment first: escapes are FORBIDDEN even when the target doesn't exist (no existence oracle).
    const lexical = path.resolve(root, rel);
    if (!lexical.startsWith(root + path.sep)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    abs = realpathSync(lexical);
    if (!abs.startsWith(root + path.sep) || !statSync(abs).isFile()) throw new Error("FORBIDDEN");
  } catch (e) {
    const missing = e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT";
    return NextResponse.json({ error: missing ? "NOT_FOUND" : "FORBIDDEN" }, { status: missing ? 404 : 403 });
  }
  const ext = abs.endsWith(".email.html") || abs.endsWith(".print.html") ? ".html" : path.extname(abs);
  const download = request.nextUrl.searchParams.get("download") === "1" || ext === ".eml";
  return new NextResponse(readFileSync(abs), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      // Forged HTML is previewed in a sandboxed iframe; never let it run with app privileges.
      "content-security-policy": "sandbox; default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https:; font-src https: data:",
      ...(download ? { "content-disposition": `attachment; filename="${path.basename(abs)}"` } : {}),
    },
  });
}
