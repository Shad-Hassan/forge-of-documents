// Golden receipt for the thread family: loads each thread spec from disk, renders it, and diffs the result
// against the thread.py output in golden/thread. Screenshots (thread.py --check) are not part of this check.
//
//   npx tsx scripts/threadcheck.ts
//
// Normalisation is the same as scripts/golden.ts. Exit 0 = every case IDENTICAL, 1 = any DIFF, 2 = error.
import { readFileSync } from "node:fs";
import { thread } from "../lib/families/thread/index";
import { loadThreadInput } from "../lib/families/thread/load";

const DRAFTS = "/home/shad/Documents/0_CurrentSessionDocuments/artifactHtml/drafts";
const CASES: { spec: string; golden: string }[] = [
  { spec: `${DRAFTS}/tahmid-scope-thread.json`, golden: "golden/thread/tahmid-scope-thread.thread.html" },
  { spec: `${DRAFTS}/tahmid-redflags-thread.json`, golden: "golden/thread/tahmid-redflags-thread.thread.html" },
];

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

async function main(): Promise<void> {
  let bad = 0;
  for (const c of CASES) {
    const input = await loadThreadInput(c.spec);
    const got = normalise(thread.render(input));
    const want = normalise(readFileSync(c.golden, "utf8"));
    if (got === want) {
      console.log(`IDENTICAL  thread ${c.spec} bytes=${got.length}`);
      continue;
    }
    bad++;
    const g = got.split(/(?=<)/);
    const w = want.split(/(?=<)/);
    let i = 0;
    while (i < g.length && i < w.length && g[i] === w[i]) i++;
    console.log(`DIFF  thread ${c.spec} got=${got.length}B want=${want.length}B first_divergence_token=${i}`);
    for (let k = i; k < Math.min(i + 6, Math.max(g.length, w.length)); k++) {
      console.log(`  want: ${(w[k] ?? "<EOF>").slice(0, 160)}`);
      console.log(`  got:  ${(g[k] ?? "<EOF>").slice(0, 160)}`);
    }
  }
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
