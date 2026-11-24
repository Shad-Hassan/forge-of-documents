// I/O half of the thread family: reads exactly the files thread.py would read, relative to the spec's folder.
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { bentoSchema, inputSchema, specSchema, type ThreadInput } from "./schema";


function readText(base: string, key: string): string {
  return readFileSync(path.resolve(base, key), "utf8");
}

/**
 * Loads a thread spec from disk and returns the pure render input.
 * Files, keyed by the path as written: each message's `body` (text), `bento` (text) and the bento's `receipts`
 * (text), and each `shot` (image, base64-encoded). Missing files throw, as the Python would.
 */
export async function loadThreadInput(specPath: string): Promise<ThreadInput> {
  const abs = path.resolve(specPath);
  const base = path.dirname(abs);
  const spec = specSchema.parse(JSON.parse(readFileSync(abs, "utf8")));
  const files: Record<string, string> = {};

  for (const m of spec.messages) {
    if (m.bento !== undefined) {
      const text = readText(base, m.bento);
      files[m.bento] = text;
      const bento = bentoSchema.parse(JSON.parse(text));
      files[bento.receipts] = readText(base, bento.receipts);
    } else if (m.shot !== undefined) {
      files[m.shot] = readFileSync(path.resolve(base, m.shot)).toString("base64");
    } else if (m.body !== undefined) {
      files[m.body] = readText(base, m.body);
    }
    // sent_edits are applied to the body text already in files; no extra reads.
  }
  return inputSchema.parse({ ...spec, files });
}
