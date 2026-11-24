import { NextRequest, NextResponse } from "next/server";
import { saveUpload } from "@/lib/uploads/store";

type UploadResult =
  | { name: string; ok: true; path: string; bytes: number; sha256: string }
  | { name: string; ok: false; error: string };

const KNOWN_ERRORS = new Set(["UNSUPPORTED_TYPE", "TOO_LARGE", "BAD_CONTENT"]);

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const results: UploadResult[] = [];

  for (const file of files) {
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const saved = await saveUpload(file.name, bytes);
      results.push({
        name: file.name,
        ok: true,
        path: saved.path,
        bytes: saved.bytes,
        sha256: saved.sha256,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      results.push({
        name: file.name,
        ok: false,
        error: KNOWN_ERRORS.has(msg) ? msg : "INTERNAL",
      });
    }
  }

  const anyOk = results.some((r) => r.ok);
  return NextResponse.json({ results }, { status: anyOk ? 200 : 400 });
}
