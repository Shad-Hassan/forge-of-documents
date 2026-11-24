// Round-trip proof: golden draft -> generation shape (fromDraft, local to this script)
// -> generationSchema.parse -> toDraft -> family.render, compared with the golden file.
//
//   npx tsx scripts/gencheck.ts
//
// Exit 0 = every case IDENTICAL after the same normalisation as scripts/golden.ts.
import { readFileSync } from "node:fs";
import type { Family, OutputKind } from "../lib/engine/types";

const SKILL = "/home/shad/.claude/skills/replyCast";
const DRAFTS = "/home/shad/Documents/0_CurrentSessionDocuments/artifactHtml/drafts";
const GOLD = "/home/shad/Titanium_X_00/Forge-of-Documents-II/app/golden";
const TONES = ["warn", "danger", "ok", "reach", "info", "ask", "danger-soft", "orange", "go"];

type Json = any;

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

// ---- fromDraft helpers (draft JSON -> generation shape). Not exported from the families. ----

function replyBlock(b: Json): Json {
  if ("lead" in b) return { type: "lead", text: b.lead, ...(b.url !== undefined ? { url: b.url } : {}) };
  if ("tag" in b) return { type: "tag", text: b.tag };
  if ("urls" in b) {
    const u = b.urls;
    return {
      type: "urls",
      title: u.title,
      items: Object.entries(u.items).map(([key, value]) => ({ key, value })),
      ...(u.empty !== undefined ? { empty: u.empty } : {}),
    };
  }
  if ("h1" in b) return { type: "h1", text: b.h1 };
  if ("h2" in b) return { type: "h2", text: b.h2 };
  if ("h3" in b) return { type: "h3", text: b.h3 };
  if ("p" in b) return { type: "p", text: b.p };
  if ("shot" in b) return { type: "shot", path: b.shot, ...(b.caption !== undefined ? { caption: b.caption } : {}) };
  if ("table" in b) {
    const t = b.table;
    const out: Json = { type: "table", head: t.head, rows: t.rows };
    if (t.highlight !== undefined) out.highlight = t.highlight;
    if (t.row_tones !== undefined) out.row_tones = t.row_tones.map((x: string) => (x === "" ? null : x));
    if (t.tone !== undefined) out.tone = t.tone === "" ? null : t.tone;
    if (t.stamp !== undefined) out.stamp = t.stamp;
    return out;
  }
  const key = TONES.find((k) => k in b);
  if (!key) throw new Error(`fromDraft: unknown reply block ${JSON.stringify(b)}`);
  return { type: "tone", tone: key, text: b[key], ...(b.icon !== undefined ? { icon: b.icon } : {}) };
}

export function replyFromDraft(d: Json): Json {
  const out: Json = { slug: d.slug, blocks: d.blocks.map(replyBlock) };
  for (const k of ["subject", "greeting", "signoff", "name"]) if (d[k] !== undefined) out[k] = d[k];
  if (d.after !== undefined) out.after = d.after.map(replyBlock);
  return out;
}

export function plexioFromDraft(d: Json): Json {
  const out: Json = { ...d };
  if (d.facts) out.facts = d.facts.map(([label, value]: [string, string]) => ({ label, value }));
  if (d.progress) {
    out.progress = {
      ...(d.progress.title !== undefined ? { title: d.progress.title } : {}),
      rows: d.progress.rows.map(([label, value, tone]: [string, string, string]) => ({ label, value, tone })),
    };
  }
  return out;
}

export function wardenFromDraft(d: Json): Json {
  const blocks = d.blocks.map((b: Json) =>
    b.type === "hero" ? { ...b, facts: b.facts.map(([n, label]: [string | number, string]) => ({ n: String(n), label })) } : b,
  );
  return { ...d, blocks };
}

// ---- cases ----

interface Case {
  name: string;
  family: string;
  kind: OutputKind;
  draft: string;
  golden: string;
  fromDraft: (d: Json) => Json;
}

const cases: Case[] = [
  { name: "replycast tahmid-scope-reply", family: "replycast", kind: "email", draft: `${SKILL}/golden/tahmid-scope-reply.json`, golden: `${GOLD}/replycast/tahmid-scope-reply.email.html`, fromDraft: replyFromDraft },
  { name: "replycast tahmid-scope-receipts", family: "replycast", kind: "email", draft: `${SKILL}/examples/receipts.json`, golden: `${GOLD}/replycast/tahmid-scope-receipts.email.html`, fromDraft: replyFromDraft },
  { name: "plexio command-center email", family: "plexio", kind: "email", draft: `${DRAFTS}/command-center-status-update.json`, golden: `${GOLD}/plexio/command-center-status-update.email.html`, fromDraft: plexioFromDraft },
  { name: "plexio command-center text", family: "plexio", kind: "text", draft: `${DRAFTS}/command-center-status-update.json`, golden: `${GOLD}/plexio/command-center-status-update.txt`, fromDraft: plexioFromDraft },
  { name: "plexio command-center web", family: "plexio", kind: "web", draft: `${DRAFTS}/command-center-status-update.json`, golden: `${GOLD}/plexio/command-center-status-update.html`, fromDraft: plexioFromDraft },
  { name: "plexio rentcast email", family: "plexio", kind: "email", draft: `${DRAFTS}/phase1-rentcast-followup.json`, golden: `${GOLD}/plexio/phase1-rentcast-followup.email.html`, fromDraft: plexioFromDraft },
  { name: "plexio rentcast text", family: "plexio", kind: "text", draft: `${DRAFTS}/phase1-rentcast-followup.json`, golden: `${GOLD}/plexio/phase1-rentcast-followup.txt`, fromDraft: plexioFromDraft },
  { name: "plexio rentcast web", family: "plexio", kind: "web", draft: `${DRAFTS}/phase1-rentcast-followup.json`, golden: `${GOLD}/plexio/phase1-rentcast-followup.html`, fromDraft: plexioFromDraft },
  { name: "warden fixture email", family: "warden", kind: "email", draft: `${GOLD}/warden/fixture.json`, golden: `${GOLD}/warden/fixture.email.html`, fromDraft: wardenFromDraft },
];

async function main(): Promise<void> {
  let failures = 0;
  for (const c of cases) {
    try {
      const mod = (await import(`../lib/families/${c.family}/index.ts`)) as { family: Family };
      const fam = mod.family;
      const gen = fam.generation;
      if (!gen) throw new Error("family has no generation");
      const draftJson = JSON.parse(readFileSync(c.draft, "utf8"));
      const genOut = gen.schema.parse(c.fromDraft(draftJson));
      const draft = gen.toDraft(genOut);
      const got = normalise(fam.render(draft, c.kind));
      const want = normalise(readFileSync(c.golden, "utf8"));
      if (got === want) {
        console.log(`IDENTICAL  ${c.name} (${c.family} ${c.kind}, ${got.length}B)`);
      } else {
        failures++;
        const g = got.split(/(?=<)/), w = want.split(/(?=<)/);
        let i = 0;
        while (i < g.length && i < w.length && g[i] === w[i]) i++;
        console.log(`DIFF  ${c.name}: first divergence at token ${i}`);
        console.log(`  want: ${(w[i] ?? "<EOF>").slice(0, 160)}`);
        console.log(`  got:  ${(g[i] ?? "<EOF>").slice(0, 160)}`);
      }
    } catch (e: any) {
      failures++;
      console.log(`FAIL  ${c.name}: ${String(e?.message ?? e).slice(0, 400)}`);
    }
  }
  console.log(failures === 0 ? `ALL ${cases.length} IDENTICAL` : `${failures} of ${cases.length} NOT IDENTICAL`);
  process.exitCode = failures === 0 ? 0 : 1;
}

if (require.main === module) main();
