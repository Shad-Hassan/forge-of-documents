// Golden receipt: render a draft JSON through a TS family and diff it against the Python output.
//
//   npx tsx scripts/golden.ts <family> <kind> <input.json> <expected.html|txt>
//
// Exit 0 = IDENTICAL after normalisation. Exit 1 = DIFF (first differing lines printed).
// Normalisation: CRLF -> LF, trailing whitespace per line stripped, runs of blank lines collapsed,
// whitespace between tags collapsed. Nothing else. Text content and attributes must match exactly.
import { readFileSync } from "node:fs";
import type { Family, OutputKind } from "../lib/engine/types";

const [familyId, kind, inputPath, expectedPath] = process.argv.slice(2);
if (!familyId || !kind || !inputPath || !expectedPath) {
  console.error("usage: tsx scripts/golden.ts <family> <kind> <input.json> <expected>");
  process.exit(2);
}

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

async function main(): Promise<never> {
const mod = (await import(`../lib/families/${familyId}/index.ts`)) as { family: Family };
const fam = mod.family;
const input = fam.schema.parse(JSON.parse(readFileSync(inputPath, "utf8")));
const got = normalise(fam.render(input, kind as OutputKind));
const want = normalise(readFileSync(expectedPath, "utf8"));

if (got === want) {
  console.log(`IDENTICAL  family=${familyId} kind=${kind} bytes=${got.length}`);
  process.exit(0);
}

const g = got.split(/(?=<)/), w = want.split(/(?=<)/);
let i = 0;
while (i < g.length && i < w.length && g[i] === w[i]) i++;
const diffs = Math.max(g.length, w.length) - i;
console.log(`DIFF  family=${familyId} kind=${kind} got=${got.length}B want=${want.length}B first_divergence_token=${i} tokens_after=${diffs}`);
for (let k = i; k < Math.min(i + 6, Math.max(g.length, w.length)); k++) {
  console.log(`  want: ${(w[k] ?? "<EOF>").slice(0, 160)}`);
  console.log(`  got:  ${(g[k] ?? "<EOF>").slice(0, 160)}`);
}
process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
