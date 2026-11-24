import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ROOTS } from "./roots";
import { resolveSafe } from "./safe";
import { PDFTOTEXT, EXCLUDED_DIRS, cacheBase, cacheFileFor, syncPdfCache } from "./cache";
import type {
  FileHit,
  ListArgs,
  ListEntry,
  ReadArgs,
  ReadResult,
  RootName,
  SearchArgs,
  Snippet,
} from "./types";

export type { FileHit, ListArgs, ListEntry, ReadArgs, ReadResult, SearchArgs, Snippet } from "./types";

const GREP = "/usr/bin/grep"; // GNU grep 3.11
const run = promisify(execFile);
const ALL_ROOTS: RootName[] = ["artifacts", "uploads"];

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** grep exit 1 = no match (empty). Exit 2 with partial output (unreadable file) keeps the output. */
async function grepRaw(args: string[]): Promise<string> {
  try {
    const { stdout } = await run(GREP, args, { maxBuffer: 20 * 1024 * 1024, timeout: 15000 });
    return stdout;
  } catch (err: any) {
    if (err?.code === 1) return "";
    if (err?.code === 2 && typeof err.stdout === "string" && err.stdout.length > 0) return err.stdout;
    throw new Error(`SEARCH_FAILED: ${String(err?.stderr || err?.message).slice(0, 300)}`);
  }
}

interface Parsed {
  lines: Map<number, string>;
  matches: number[];
}

/** Parses `grep -n -Z` output: "<file>\0<n>:<text>" for matches, "<file>\0<n>-<text>" for context. */
function parseGrep(out: string): Map<string, Parsed> {
  const files = new Map<string, Parsed>();
  for (const line of out.split("\n")) {
    const nul = line.indexOf("\0");
    if (nul < 0) continue; // "--" group separators and blanks
    const file = line.slice(0, nul);
    const m = /^(\d+)([:-])/.exec(line.slice(nul + 1));
    if (!m) continue;
    const n = Number(m[1]);
    const text = line.slice(nul + 1 + m[0].length);
    let p = files.get(file);
    if (!p) {
      p = { lines: new Map(), matches: [] };
      files.set(file, p);
    }
    p.lines.set(n, text);
    if (m[2] === ":") p.matches.push(n);
  }
  return files;
}

function snippetsFor(p: Parsed): Snippet[] {
  return p.matches.slice(0, 5).map((n) => {
    const parts: string[] = [];
    for (let k = n - 2; k <= n + 2; k++) {
      const t = p.lines.get(k);
      if (t !== undefined) parts.push(t);
    }
    let text = parts.join("\n");
    if (text.length > 600) text = text.slice(0, 597) + "...";
    return { line: n, text };
  });
}

/** Sibling meta: "<stem>.meta.json" for each dot-prefix of the name, then "<name>.meta.json". */
function metaFor(abs: string): Record<string, unknown> | null {
  const dir = path.dirname(abs);
  const name = path.basename(abs);
  const parts = name.split(".");
  const candidates: string[] = [];
  for (let i = parts.length; i >= 1; i--) {
    const cand = path.join(dir, parts.slice(0, i).join(".") + ".meta.json");
    if (cand !== abs && !candidates.includes(cand)) candidates.push(cand);
  }
  for (const cand of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(cand, "utf8"));
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      /* missing or unreadable */
    }
  }
  return null;
}

function titleFor(abs: string): string {
  const t = metaFor(abs)?.title;
  return typeof t === "string" && t.length > 0 ? t : path.basename(abs);
}

function globToRe(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp("^" + re + "$", "i");
}

function globOk(glob: string | undefined, rel: string): boolean {
  if (!glob) return true;
  const target = glob.includes("/") ? rel : path.posix.basename(rel);
  return globToRe(glob).test(target);
}

export async function search(args: SearchArgs): Promise<FileHit[]> {
  const limit = Math.min(args.limit ?? 20, 50);
  const roots = args.roots && args.roots.length > 0 ? args.roots : ALL_ROOTS;
  const regex = args.regex === true;
  const common = ["-r", "-i", "-n", "-I", "-Z", "-C", "2", "-m", "5"];
  if (!regex) common.push("-F");
  for (const d of EXCLUDED_DIRS) common.push(`--exclude-dir=${d}`);

  const found: Array<{ root: RootName; abs: string; rel: string; snippets: Snippet[] }> = [];

  for (const root of roots) {
    if (!isDir(ROOTS[root])) continue;
    const real = fs.realpathSync(ROOTS[root]);
    await syncPdfCache(root);

    // Originals: PDFs are excluded here (binary to grep) and searched through the text cache.
    const mainOut = await grepRaw([...common, "--exclude=*.pdf", "--", args.pattern, real]);
    for (const [file, p] of parseGrep(mainOut)) {
      const rel = path.relative(real, file).split(path.sep).join("/");
      if (!globOk(args.glob, rel)) continue;
      found.push({ root, abs: path.join(real, rel), rel, snippets: snippetsFor(p) });
    }

    // PDFs: grep the extracted text, map each hit back to the PDF's own path.
    const cb = cacheBase(root);
    if (isDir(cb)) {
      const cacheOut = await grepRaw([...common, "--", args.pattern, cb]);
      for (const [file, p] of parseGrep(cacheOut)) {
        const rel = path.relative(cb, file).split(path.sep).join("/").replace(/\.txt$/, "");
        if (!globOk(args.glob, rel)) continue;
        found.push({ root, abs: path.join(real, rel), rel, snippets: snippetsFor(p) });
      }
    }
  }

  found.sort((a, b) => (a.root + ":" + a.rel < b.root + ":" + b.rel ? -1 : 1));
  return found.slice(0, limit).map((f) => ({
    path: f.rel,
    root: f.root,
    title: titleFor(f.abs),
    snippets: f.snippets,
  }));
}

function htmlToText(html: string): string {
  let s = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<h[1-3]\b[^>]*>/gi, "\n# ").replace(/<\/h[1-3]>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|section|article|header|footer|h[4-6])>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, "").replace(/[ \t]{2,}/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

async function pdfText(root: RootName, abs: string, rel: string): Promise<string> {
  const cached = cacheFileFor(root, rel);
  try {
    if (fs.statSync(cached).mtimeMs >= fs.statSync(abs).mtimeMs) return fs.readFileSync(cached, "utf8");
  } catch {
    /* no fresh cache: fall through */
  }
  const { stdout } = await run(PDFTOTEXT, ["-layout", abs, "-"], { maxBuffer: 50 * 1024 * 1024 });
  return stdout;
}

const MAX_SPAN = 800;
const DEFAULT_TO = 400;

export async function read(args: ReadArgs): Promise<ReadResult> {
  const { root, abs, rel } = resolveSafe(args.path);
  if (fs.statSync(abs).isDirectory()) throw new Error("NOT_FOUND: is a directory");

  const ext = path.extname(abs).toLowerCase();
  let text: string;
  if (ext === ".html" || ext === ".htm") {
    text = htmlToText(fs.readFileSync(abs, "utf8"));
  } else if (ext === ".pdf") {
    text = await pdfText(root, abs, rel);
  } else if (ext === ".docx") {
    let side: { abs: string };
    try {
      side = resolveSafe(args.path + ".txt");
    } catch {
      throw new Error("NOT_FOUND: docx has no .txt sidecar");
    }
    text = fs.readFileSync(side.abs, "utf8");
  } else {
    text = fs.readFileSync(abs, "utf8");
  }

  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const totalLines = lines.length;

  const from = Math.max(1, args.from ?? 1);
  let to = args.to ?? DEFAULT_TO;
  if (to < from) throw new Error("BAD_RANGE: to < from");
  if (to - from + 1 > MAX_SPAN) to = from + MAX_SPAN - 1;
  to = Math.min(to, totalLines);

  return {
    path: rel,
    root,
    title: titleFor(abs),
    text: lines.slice(from - 1, to).join("\n"),
    from,
    to,
    totalLines,
  };
}

export async function list(args: ListArgs): Promise<ListEntry[]> {
  const { root, abs, rel } = resolveSafe(args.dir ?? "artifacts:");
  if (!fs.statSync(abs).isDirectory()) throw new Error("NOT_FOUND: not a directory");

  const entries: ListEntry[] = [];
  for (const name of fs.readdirSync(abs)) {
    if (name.endsWith(".meta.json")) continue;
    let child: { abs: string; rel: string };
    try {
      child = resolveSafe(`${root}:${rel ? rel + "/" : ""}${name}`);
    } catch {
      continue; // escaping or broken symlink: never listed
    }
    const st = fs.statSync(child.abs);
    const entry: ListEntry = { path: child.rel, root, bytes: st.size };
    const meta = metaFor(child.abs);
    if (meta) {
      if (typeof meta.title === "string") entry.title = meta.title;
      if (typeof meta.style === "string") entry.style = meta.style;
      if (typeof meta.generation === "number") entry.generation = meta.generation;
      if (typeof meta.audience === "string") entry.audience = meta.audience;
    }
    entries.push(entry);
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return entries.slice(0, args.limit ?? 200);
}
