import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ROOTS } from "./roots";
import type { RootName } from "./types";

const run = promisify(execFile);

/** Extracted PDF text lives here, never inside a corpus root. */
export const TEXTCACHE = process.env.FORGE_TEXTCACHE ?? path.join(process.cwd(), "data/textcache");
export const PDFTOTEXT = "/usr/bin/pdftotext";
export const EXCLUDED_DIRS = ["node_modules", "__pycache__", ".git", ".next"];

export function cacheBase(root: RootName): string {
  return path.join(TEXTCACHE, root);
}

/** TEXTCACHE/<root>/<rel path>.txt, where rel is the PDF's path inside its root. */
export function cacheFileFor(root: RootName, rel: string): string {
  return path.join(cacheBase(root), rel + ".txt");
}

function walkPdfs(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue; // never follow links out of the root
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(e.name)) walkPdfs(p, out);
    } else if (e.isFile() && /\.pdf$/i.test(e.name)) {
      out.push(p);
    }
  }
}

/**
 * Extracts text for every PDF under the root whose cache file is missing or older
 * than the PDF. Returns how many were extracted and how many were already fresh.
 */
export async function syncPdfCache(root: RootName): Promise<{ extracted: number; fresh: number }> {
  let base: string;
  try {
    base = fs.realpathSync(ROOTS[root]);
  } catch {
    return { extracted: 0, fresh: 0 };
  }
  const pdfs: string[] = [];
  walkPdfs(base, pdfs);

  let fresh = 0;
  const todo: Array<[string, string]> = [];
  for (const abs of pdfs) {
    const rel = path.relative(base, abs).split(path.sep).join("/");
    const out = cacheFileFor(root, rel);
    let stale = true;
    try {
      if (fs.statSync(out).mtimeMs >= fs.statSync(abs).mtimeMs) stale = false;
    } catch {
      /* no cache file yet */
    }
    if (stale) todo.push([abs, out]);
    else fresh++;
  }

  let extracted = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < todo.length) {
      const [abs, out] = todo[next++];
      fs.mkdirSync(path.dirname(out), { recursive: true });
      try {
        await run(PDFTOTEXT, ["-layout", abs, out], { maxBuffer: 50 * 1024 * 1024 });
        extracted++;
      } catch (err) {
        fs.rmSync(out, { force: true });
        console.warn(`pdftotext failed, skipped: ${abs}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { extracted, fresh };
}
