// Offline receipt for forge + the document store (E1/E2). Stubbed Claude client, real schemas,
// renderers and file writes. No API call.
//   1. forge() each family -> doc.json + v1/ (draft.json, outputs, note)
//   2. saveVersion() with an edited draft -> v2/, v1 byte-unchanged (sha256), doc.json lists both
//   3. invalid draft -> rejected, no v3 created
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Append " (edited)" to the first top-level string field (field names differ per family). */
function markFirstString(d: any): any {
  const k = Object.keys(d).find((key) => typeof d[key] === "string" && d[key].length > 0)!;
  return { ...d, [k]: `${d[k]} (edited)` };
}
const firstStringKey = (d: any) => Object.keys(d).find((key) => typeof d[key] === "string" && d[key].length > 0)!;
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const shaDir = (d: string) =>
  readdirSync(d).sort().map((f) => `${f}:${sha(path.join(d, f))}`).join("|");

async function main() {
  const out = mkdtempSync(path.join(os.tmpdir(), "forgecheck-"));
  process.env.FORGE_OUT_DIR = out;
  delete process.env.FORGE_EML_FROM;
  delete process.env.FORGE_OBSIDIAN_DIR;
  const { forge } = await import("../lib/forge/forge");
  const { saveVersion, getDoc, getDraft, listDocs } = await import("../lib/docs/store");
  const { FAMILIES } = await import("../lib/families");
  const g = await import("./gencheck");
  const cases = [
    { family: "plexio" as const, draft: "/home/shad/Documents/0_CurrentSessionDocuments/artifactHtml/drafts/phase1-rentcast-followup.json", conv: g.plexioFromDraft, edit: markFirstString },
    { family: "replycast" as const, draft: "/home/shad/.claude/skills/replyCast/golden/tahmid-scope-reply.json", conv: g.replyFromDraft, edit: markFirstString },
    { family: "warden" as const, draft: path.join(__dirname, "../golden/warden/fixture.json"), conv: g.wardenFromDraft, edit: markFirstString },
  ];
  let ok = true;
  const check = (cond: boolean, label: string) => {
    ok &&= cond;
    console.log(`${cond ? "PASS" : "FAIL"} ${label}`);
  };

  for (const c of cases) {
    const genOut = FAMILIES[c.family].generation!.schema.parse(c.conv(JSON.parse(readFileSync(c.draft, "utf8"))));
    const fake = { messages: { parse: async () => ({ stop_reason: "end_turn", parsed_output: genOut, usage: { input_tokens: 0, output_tokens: 0 } }) } };
    const r = await forge({ content: "Cited answer.\n\nSources:\n[1] INDEX.md", family: c.family, title: `Forgecheck ${c.family}`, gen: 1 }, fake as never);
    const v1 = path.join(out, r.id, "v1");
    check(r.files.every((f) => existsSync(path.join(out, f.path))) && existsSync(path.join(v1, "draft.json")) && r.files.some((f) => f.kind === "note"),
      `${c.family}: v1 written (${r.files.map((f) => f.kind).join(",")} + draft.json)`);
    const before = shaDir(v1);

    const edited = c.edit(getDraft(r.id));
    const { version } = await saveVersion(r.id, edited, "edit", "subject tweak");
    const doc = getDoc(r.id);
    check(version.n === 2 && existsSync(path.join(out, r.id, "v2", "draft.json")), `${c.family}: edit -> v2`);
    check(shaDir(v1) === before, `${c.family}: v1 byte-unchanged after edit (sha256 of every file)`);
    check(doc.versions.map((v) => v.n).join(",") === "1,2" && doc.style === c.family && doc.generation === 1, `${c.family}: doc.json lists v1,v2 with style+generation`);
    const k = firstStringKey(getDraft(r.id, 1));
    const d1 = getDraft(r.id, 1) as any, d2 = getDraft(r.id, 2) as any;
    const changed = Object.keys({ ...d1, ...d2 }).filter((key) => JSON.stringify(d1[key]) !== JSON.stringify(d2[key]));
    check(changed.length === 1 && changed[0] === k && String(d2[k]).endsWith("(edited)"), `${c.family}: v2 differs from v1 only in "${k}"`);

    let rejected = false;
    try { await saveVersion(r.id, { nope: 1 }, "edit"); } catch { rejected = true; }
    check(rejected && !existsSync(path.join(out, r.id, "v3")) && getDoc(r.id).versions.length === 2, `${c.family}: invalid draft rejected, no v3`);
  }
  check(listDocs().length === 3, "listDocs returns 3 docs");

  rmSync(out, { recursive: true, force: true });
  console.log(ok ? "ALL PASS" : "FAILURES");
  process.exit(ok ? 0 : 1);
}
main();
