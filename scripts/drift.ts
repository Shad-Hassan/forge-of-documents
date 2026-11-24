// Drift sweep: every real draft in the artifactHtml drafts folder, rendered by the TS family
// and diffed against the Python expected output produced by scripts/drift-regen.py (frozen *_legacy.py originals).
//
//   npx tsx scripts/drift.ts [expectedDir]        (default: golden/drift/expected)
//
// Classification (no Python is run here):
//   replycast  meta build command mentions replyCast/build.py, or (no meta-mention) parses under replycast schema and not plexio
//   plexio     meta build command mentions build_note.py, or parses under plexio schema
//   other      everything else (listed, skipped)
// Exit 0 only if every rendered (draft, family, kind) is IDENTICAL.
// Normalisation is the same as scripts/golden.ts.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const DRAFTS = "/home/shad/Documents/0_CurrentSessionDocuments/artifactHtml/drafts";
const EXPECTED = process.argv[2] ?? join(__dirname, "../golden/drift/expected");

function normalise(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/>\s+</g, "><")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// Fetch stub: same bytes as the Python urlopen stub (b"IMG"). No network.
const fetchStub = (async () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => new TextEncoder().encode("IMG").buffer,
})) as unknown as typeof fetch;

type Kind = "email" | "text" | "web";
interface Fam {
  schema: { parse(x: unknown): unknown; safeParse(x: unknown): { success: boolean; error?: unknown } };
  render(input: unknown, kind: Kind): string;
  renderAsync?(input: unknown, kind: Kind): Promise<string>;
}

function firstDiff(got: string, want: string): string {
  const g = got.split(/(?=<)/), w = want.split(/(?=<)/);
  let i = 0;
  while (i < g.length && i < w.length && g[i] === w[i]) i++;
  return `token=${i} want=${(w[i] ?? "<EOF>").slice(0, 120)} got=${(g[i] ?? "<EOF>").slice(0, 120)}`;
}

async function renderTs(fam: Fam, input: unknown, kind: Kind): Promise<string> {
  if (kind === "web") {
    const real = globalThis.fetch;
    globalThis.fetch = fetchStub;
    try {
      return await (fam.renderAsync as (i: unknown, k: Kind) => Promise<string>)(input, kind);
    } finally {
      globalThis.fetch = real;
    }
  }
  return fam.render(input, kind);
}

async function main(): Promise<number> {
  const rc = ((await import("../lib/families/replycast/index")) as { family: Fam }).family;
  const pl = ((await import("../lib/families/plexio/index")) as { family: Fam }).family;

  const counts = { replycast: 0, plexio: 0, other: 0 };
  const others: string[] = [];
  const pyFails: string[] = [];
  const lines: string[] = [];
  let identical = 0, diff = 0;

  const names = readdirSync(DRAFTS).filter((f) => f.endsWith(".json") && !f.endsWith(".meta.json")).sort();
  for (const f of names) {
    const name = basename(f, ".json");
    const metaPath = join(DRAFTS, `${name}.meta.json`);
    const meta = existsSync(metaPath) ? readFileSync(metaPath, "utf8") : null;
    const raw = readFileSync(join(DRAFTS, f), "utf8");
    let json: unknown = null;
    try { json = JSON.parse(raw); } catch { json = null; }

    const parses = (fam: Fam): boolean => json !== null && fam.schema.safeParse(json).success;
    let family: "replycast" | "plexio" | null = null;
    if (meta && meta.includes("replyCast/build.py")) family = "replycast";
    else if (meta && meta.includes("build_note.py")) family = "plexio";
    else if (parses(pl)) family = "plexio";
    else if (parses(rc)) family = "replycast";

    if (family === null) {
      counts.other++;
      const script = meta?.match(/[\w./~-]+\.py/)?.[0] ?? "no-meta";
      others.push(`${name}  [${script}]`);
      continue;
    }
    counts[family]++;

    const kinds: Kind[] = family === "replycast" ? ["email"] : ["email", "text", "web"];
    const fam = family === "replycast" ? rc : pl;
    const famTag = family === "replycast" ? "replycast" : "plexio";

    // Python side failed: record and skip.
    const failMarker = join(EXPECTED, `${name}.${famTag}.FAILED`);
    if (existsSync(failMarker)) {
      pyFails.push(`${name} ${famTag}: ${readFileSync(failMarker, "utf8").trim()}`);
      lines.push(`PYTHON-FAILS  ${name} ${famTag}`);
      continue;
    }

    let input: unknown;
    try {
      input = fam.schema.parse(json);
    } catch (e) {
      diff++;
      lines.push(`DIFF  ${name} ${famTag} schema-rejects: ${String((e as Error).message).slice(0, 160)}`);
      continue;
    }

    for (const kind of kinds) {
      const expPath = join(EXPECTED, `${name}.${famTag}.${kind === "email" ? "email" : kind === "text" ? "text" : "web"}`);
      if (!existsSync(expPath)) {
        diff++;
        lines.push(`DIFF  ${name} ${famTag} ${kind} no-python-expected`);
        continue;
      }
      let got: string;
      try {
        got = normalise(await renderTs(fam, input, kind));
      } catch (e) {
        diff++;
        lines.push(`DIFF  ${name} ${famTag} ${kind} ts-throws: ${String((e as Error).message).slice(0, 160)}`);
        continue;
      }
      const want = normalise(readFileSync(expPath, "utf8"));
      if (got === want) {
        identical++;
        lines.push(`IDENTICAL  ${name} ${famTag} ${kind}`);
      } else {
        diff++;
        lines.push(`DIFF  ${name} ${famTag} ${kind} ${firstDiff(got, want)}`);
      }
    }
  }

  for (const l of lines) console.log(l);
  console.log("");
  console.log(`classified: replycast=${counts.replycast} plexio=${counts.plexio} other=${counts.other} python-fails=${pyFails.length}`);
  console.log("other (skipped):");
  for (const o of others) console.log(`  ${o}`);
  console.log("python-fails:");
  for (const p of pyFails) console.log(`  ${p}`);
  const M = identical + diff;
  console.log(`raw: IDENTICAL=${identical} DIFF=${diff}`);
  console.log(`${identical}/${M} IDENTICAL`);
  return diff === 0 && M > 0 ? 0 : 1;
}

main().then((code) => process.exit(code), (e) => {
  console.error(e);
  process.exit(2);
});
