import fs from "node:fs";
import path from "node:path";
import { ROOTS } from "./roots";
import type { RootName } from "./types";

function isInside(base: string, target: string): boolean {
  return target === base || target.startsWith(base.endsWith(path.sep) ? base : base + path.sep);
}

/**
 * Resolves "<root>:<relative path>" to an absolute path that is guaranteed to sit
 * inside the realpath of its root. Throws "FORBIDDEN ..." or "NOT_FOUND ...".
 */
export function resolveSafe(spec: string): { root: RootName; abs: string; rel: string } {
  const idx = spec.indexOf(":");
  if (idx < 0) throw new Error("FORBIDDEN: spec must be <root>:<path>");
  const rootName = spec.slice(0, idx);
  const rel = spec.slice(idx + 1);
  if (!Object.prototype.hasOwnProperty.call(ROOTS, rootName)) {
    throw new Error(`FORBIDDEN: unknown root "${rootName}"`);
  }
  const root = rootName as RootName;
  if (rel.includes("\0")) throw new Error("FORBIDDEN: NUL byte in path");
  if (path.isAbsolute(rel)) throw new Error("FORBIDDEN: absolute path");

  let base: string;
  try {
    base = fs.realpathSync(ROOTS[root]);
  } catch {
    throw new Error(`NOT_FOUND: root "${root}" does not exist`);
  }

  const lexical = path.resolve(base, rel);
  if (!isInside(base, lexical)) throw new Error("FORBIDDEN: path escapes root");

  let real: string;
  try {
    real = fs.realpathSync(lexical);
  } catch {
    throw new Error(`NOT_FOUND: ${spec}`);
  }
  if (!isInside(base, real)) throw new Error("FORBIDDEN: symlink escapes root");

  return { root, abs: real, rel: path.relative(base, real).split(path.sep).join("/") };
}
