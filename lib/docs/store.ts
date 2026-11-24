// Document store: every forged document is a versioned record on disk.
//   data/out/<id>/doc.json          the record (the only file ever rewritten, atomically)
//   data/out/<id>/v<n>/draft.json   the renderer draft for that version
//   data/out/<id>/v<n>/<id>.*       rendered outputs + <id>.md Obsidian note
// Append-only: a save creates v<n+1>; existing version folders are never modified.
// That is the evidence rule: a client-facing doc keeps every version it ever had.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { FAMILIES } from "../families";
import { writeEml } from "../engine/deliver";
import type { FamilyId, Gen, OutputKind } from "../engine/types";
import { OUT_DIR } from "../search/roots";

export type Audience = "internal" | "client-facing";
export type VersionBy = "forge" | "edit" | "revise" | "import";

export interface OutputFile {
  kind: OutputKind | "eml" | "note";
  file: string;
  bytes: number;
  sha256: string;
}

export interface VersionMeta {
  n: number;
  created: string;
  by: VersionBy;
  note?: string;
  draftSha256: string;
  outputs: OutputFile[];
  skipped: string[];
}

export interface Citation {
  source: string;
  title: string | null;
  cited_text: string;
}

export interface DocRecord {
  id: string;
  title: string;
  family: FamilyId;
  generation: Gen;
  style: string;
  audience: Audience;
  created: string;
  updated: string;
  source?: { question?: string; content?: string; citations?: Citation[] };
  versions: VersionMeta[];
}

const EXT: Record<OutputKind, string> = { web: ".html", print: ".print.html", email: ".email.html", text: ".txt", paste: ".paste.html" };
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,100}$/;

const sha = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");

function docDir(id: string): string {
  if (!ID_RE.test(id)) throw new Error("BAD_ID");
  return path.join(OUT_DIR, id);
}

function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmp, file);
}

export function slugify(title: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${day}_${base || "artifact"}`;
}

function uniqueId(title: string): string {
  const base = slugify(title);
  let id = base;
  for (let i = 2; existsSync(path.join(OUT_DIR, id)); i++) id = `${base}-${i}`;
  return id;
}

export interface RenderedSet {
  files: Array<{ kind: OutputFile["kind"]; name: string; data: string | Buffer }>;
  skipped: string[];
}

/** Render every kind of a family for a validated draft. Pure except for plexio image inlining (renderAsync). */
export async function renderAll(family: FamilyId, draft: unknown, stem: string, subject: string): Promise<RenderedSet> {
  const fam = FAMILIES[family];
  const valid = fam.schema.parse(draft);
  const files: RenderedSet["files"] = [];
  const skipped: string[] = [];
  for (const kind of fam.kinds) {
    const html = fam.renderAsync ? await fam.renderAsync(valid, kind) : fam.render(valid, kind);
    files.push({ kind, name: `${stem}${EXT[kind]}`, data: html });
  }
  const email = files.find((f) => f.kind === "email");
  if (email) {
    const from = process.env.FORGE_EML_FROM;
    if (from) {
      const tmp = path.join(OUT_DIR, `.eml-${process.pid}-${Date.now()}`);
      writeEml(tmp, { subject, emailHtml: String(email.data), from });
      files.push({ kind: "eml", name: `${stem}.eml`, data: readFileSync(tmp) });
      rmSync(tmp);
    } else {
      skipped.push(".eml (set FORGE_EML_FROM)");
    }
  }
  skipped.push("PDF (headless shell blocked by AppArmor on this machine)");
  return { files, skipped };
}

function noteFor(doc: DocRecord, v: VersionMeta, body: string): string {
  return [
    "---",
    `title: ${JSON.stringify(doc.title)}`,
    `style: ${doc.style}`,
    `generation: ${doc.generation}`,
    `audience: ${doc.audience}`,
    `version: ${v.n}`,
    `by: ${v.by}`,
    `created: ${v.created}`,
    `outputs: [${v.outputs.filter((o) => o.kind !== "note").map((o) => JSON.stringify(o.file)).join(", ")}]`,
    "tags: [forge, artifact]",
    "---",
    "",
    `# ${doc.title}`,
    "",
    body.trim(),
    "",
  ].join("\n");
}

async function writeVersion(doc: DocRecord, draft: unknown, by: VersionBy, note?: string): Promise<VersionMeta> {
  const n = (doc.versions.at(-1)?.n ?? 0) + 1;
  const vdir = path.join(docDir(doc.id), `v${n}`);
  if (existsSync(vdir)) throw new Error("VERSION_EXISTS"); // never overwrite evidence
  const fam = FAMILIES[doc.family];
  const valid = fam.schema.parse(draft);
  const rendered = await renderAll(doc.family, valid, doc.id, doc.title);

  mkdirSync(vdir, { recursive: true });
  const draftJson = JSON.stringify(valid, null, 2) + "\n";
  writeFileSync(path.join(vdir, "draft.json"), draftJson);

  const outputs: OutputFile[] = [];
  for (const f of rendered.files) {
    writeFileSync(path.join(vdir, f.name), f.data);
    const bytes = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    outputs.push({ kind: f.kind, file: f.name, bytes: bytes.length, sha256: sha(bytes) });
  }

  const v: VersionMeta = {
    n,
    created: new Date().toISOString(),
    by,
    ...(note ? { note } : {}),
    draftSha256: sha(draftJson),
    outputs,
    skipped: rendered.skipped,
  };

  const body = doc.source?.content ?? (note ? `Version ${n}: ${note}` : `Version ${n}`);
  const md = noteFor(doc, v, body);
  const mdName = `${doc.id}.md`;
  writeFileSync(path.join(vdir, mdName), md);
  v.outputs.push({ kind: "note", file: mdName, bytes: Buffer.byteLength(md), sha256: sha(md) });

  const vault = process.env.FORGE_OBSIDIAN_DIR;
  if (vault && existsSync(vault)) copyFileSync(path.join(vdir, mdName), path.join(vault, mdName));
  else v.skipped.push("Obsidian copy (set FORGE_OBSIDIAN_DIR to a vault folder)");

  return v;
}

export interface CreateDocInput {
  title: string;
  family: FamilyId;
  generation?: Gen;
  audience?: Audience;
  source?: DocRecord["source"];
  draft: unknown;
  by?: VersionBy;
}

export async function createDoc(input: CreateDocInput): Promise<DocRecord> {
  if (!FAMILIES[input.family]) throw new Error(`UNKNOWN_FAMILY:${input.family}`);
  mkdirSync(OUT_DIR, { recursive: true });
  const id = uniqueId(input.title);
  mkdirSync(docDir(id));
  const now = new Date().toISOString();
  const doc: DocRecord = {
    id,
    title: input.title,
    family: input.family,
    generation: input.generation ?? 1,
    style: input.family,
    audience: input.audience ?? "internal",
    created: now,
    updated: now,
    ...(input.source ? { source: input.source } : {}),
    versions: [],
  };
  const v = await writeVersion(doc, input.draft, input.by ?? "forge");
  doc.versions.push(v);
  doc.updated = v.created;
  writeJsonAtomic(path.join(docDir(id), "doc.json"), doc);
  return doc;
}

export async function saveVersion(id: string, draft: unknown, by: VersionBy, note?: string): Promise<{ doc: DocRecord; version: VersionMeta }> {
  const doc = getDoc(id);
  const v = await writeVersion(doc, draft, by, note);
  doc.versions.push(v);
  doc.updated = v.created;
  writeJsonAtomic(path.join(docDir(id), "doc.json"), doc);
  return { doc, version: v };
}

export function getDoc(id: string): DocRecord {
  const file = path.join(docDir(id), "doc.json");
  if (!existsSync(file)) throw new Error("NOT_FOUND");
  return JSON.parse(readFileSync(file, "utf8")) as DocRecord;
}

export function getDraft(id: string, n?: number): unknown {
  const doc = getDoc(id);
  const v = n ?? doc.versions.at(-1)!.n;
  if (!doc.versions.some((x) => x.n === v)) throw new Error("NOT_FOUND");
  return JSON.parse(readFileSync(path.join(docDir(id), `v${v}`, "draft.json"), "utf8"));
}

export function listDocs(): Array<Pick<DocRecord, "id" | "title" | "family" | "generation" | "audience" | "updated"> & { versions: number }> {
  if (!existsSync(OUT_DIR)) return [];
  const out = [];
  for (const name of readdirSync(OUT_DIR)) {
    const file = path.join(OUT_DIR, name, "doc.json");
    if (!ID_RE.test(name) || !existsSync(file)) continue;
    try {
      const d = JSON.parse(readFileSync(file, "utf8")) as DocRecord;
      out.push({ id: d.id, title: d.title, family: d.family, generation: d.generation, audience: d.audience, updated: d.updated, versions: d.versions.length });
    } catch {
      /* skip unreadable records */
    }
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated));
}
