import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import mammoth from "mammoth";
import { ROOTS, UPLOAD_EXTS, UPLOAD_MAX_BYTES } from "../search/roots";

const SIDECAR_SUFFIX = ".docx.txt";
const MAX_NAME = 120;
const PDF_MAGIC = Buffer.from("%PDF-");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export interface SavedUpload {
  path: string;
  bytes: number;
  sha256: string;
  sidecar?: string;
}

export interface UploadEntry {
  path: string;
  bytes: number;
  sha256: string;
  mtime: string;
  sidecar: boolean;
}

function sha256Of(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Basename only, safe characters only, lowercase extension, max 120 chars. */
export function sanitizeName(original: string): string {
  let base = String(original ?? "").replace(/\0/g, "");
  base = base.split(/[\\/]/).pop() ?? "";
  base = base.replace(/[^A-Za-z0-9._-]+/g, "-");
  base = base.replace(/\.{2,}/g, ".");
  base = base.replace(/^[.-]+/, "");

  const dot = base.lastIndexOf(".");
  let stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot).toLowerCase() : "";

  if (stem.length + ext.length > MAX_NAME) {
    stem = stem.slice(0, Math.max(0, MAX_NAME - ext.length));
  }
  let out = stem + ext;
  // A user file must never look like a DOCX sidecar ("<x>.docx.txt"), or listUploads would hide it.
  if (out.toLowerCase().endsWith(SIDECAR_SUFFIX)) out = out.slice(0, -SIDECAR_SUFFIX.length) + "-docx.txt";
  return out.length > 0 ? out : "file";
}

async function writeSidecar(abs: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: abs });
  const sidecarAbs = abs + ".txt";
  await fs.writeFile(sidecarAbs, result.value, "utf8");
  return path.basename(sidecarAbs);
}

async function existingSidecar(abs: string): Promise<string | undefined> {
  try {
    await fs.access(abs + ".txt");
    return path.basename(abs + ".txt");
  } catch {
    return undefined;
  }
}

export async function saveUpload(name: string, bytes: Buffer): Promise<SavedUpload> {
  const clean = sanitizeName(name);
  const ext = path.extname(clean);

  if (!(UPLOAD_EXTS as readonly string[]).includes(ext)) {
    throw new Error("UNSUPPORTED_TYPE");
  }
  if (bytes.length > UPLOAD_MAX_BYTES) {
    throw new Error("TOO_LARGE");
  }
  if (ext === ".pdf" && !bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new Error("BAD_CONTENT");
  }
  if (ext === ".docx" && !bytes.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
    throw new Error("BAD_CONTENT");
  }

  const root = ROOTS.uploads;
  await fs.mkdir(root, { recursive: true });

  const sha256 = sha256Of(bytes);
  const stem = clean.slice(0, clean.length - ext.length);

  for (let i = 1; ; i++) {
    const candidate = i === 1 ? clean : `${stem}-${i}${ext}`;
    const abs = path.join(root, candidate);

    try {
      await fs.writeFile(abs, bytes, { flag: "wx" });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const existing = await fs.readFile(abs);
      if (sha256Of(existing) !== sha256) continue;

      // Dedupe: same bytes already stored under this name.
      let sidecar = await existingSidecar(abs);
      if (ext === ".docx" && !sidecar) {
        sidecar = await writeSidecar(abs);
      }
      return { path: candidate, bytes: bytes.length, sha256, sidecar };
    }

    // New file written.
    if (ext === ".docx") {
      try {
        const sidecar = await writeSidecar(abs);
        return { path: candidate, bytes: bytes.length, sha256, sidecar };
      } catch {
        await fs.unlink(abs).catch(() => {});
        throw new Error("BAD_CONTENT");
      }
    }
    return { path: candidate, bytes: bytes.length, sha256 };
  }
}

export async function listUploads(): Promise<UploadEntry[]> {
  const root = ROOTS.uploads;
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const names = new Set(entries);
  const out: UploadEntry[] = [];
  for (const name of entries) {
    if (name.endsWith(SIDECAR_SUFFIX)) continue;
    const abs = path.join(root, name);
    const st = await fs.lstat(abs);
    if (!st.isFile()) continue;
    const buf = await fs.readFile(abs);
    out.push({
      path: name,
      bytes: st.size,
      sha256: sha256Of(buf),
      mtime: st.mtime.toISOString(),
      sidecar: names.has(name + ".txt"),
    });
  }

  out.sort((a, b) => Date.parse(b.mtime) - Date.parse(a.mtime));
  return out;
}

export async function deleteUpload(rel: string): Promise<void> {
  if (typeof rel !== "string" || rel.includes("\0")) throw new Error("FORBIDDEN");

  const root = path.resolve(ROOTS.uploads);
  const abs = path.resolve(root, rel);
  if (abs === root || !abs.startsWith(root + path.sep)) throw new Error("FORBIDDEN");
  if (abs.endsWith(SIDECAR_SUFFIX)) throw new Error("FORBIDDEN");

  let st;
  try {
    st = await fs.lstat(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new Error("NOT_FOUND");
    throw err;
  }
  if (!st.isFile()) throw new Error("FORBIDDEN");

  await fs.unlink(abs);
  await fs.rm(abs + ".txt", { force: true });
}
