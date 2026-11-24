// forge-render: command-line renderer that replaces the Python builders.
//
//   forge-render <family> <draft.json> [--kinds email,text,web] [--out <dir>] [--name <stem>] [--eml] [--check]
//
// Output contract (copied from the Python builders):
//   replycast  build.py: writes <slug>.email.html next to the draft. Stem = draft "slug".
//              Also <slug>.paste.html (kind "paste").
//   thread     thread.py: writes <slug>.thread.html next to the spec and prints its path.
//              Input is the spec PATH; the files it references are loaded relative to it.
//   plexio     build_note.py: writes into artifactHtml/drafts regardless of where the draft is.
//              Stem = draft basename without extension. Files: .email.html, .txt, .eml, .html.
//              Python prints "built <stem>"; this prints the same header, then one absolute path per file.
//
// Exit codes: 0 ok, 1 unexpected failure, 2 usage / draft validation / missing env.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import * as path from "node:path";
import { FAMILIES } from "../lib/families/index";
import { thread } from "../lib/families/thread/index";
import type { OutputKind } from "../lib/engine/types";
import { buildNoteEml, defaultFrom, writeEml } from "../lib/engine/deliver";

// build_note.py: OUTDIR = <artifactHtml>/drafts, independent of the draft's own folder.
const PLEXIO_OUTDIR = "/home/shad/Documents/0_CurrentSessionDocuments/artifactHtml/drafts";
const EXT: Record<OutputKind, string> = {
  email: ".email.html",
  text: ".txt",
  web: ".html",
  print: ".print.html",
  paste: ".paste.html",
};

const USAGE =
  "usage: forge-render <family> <draft.json> [--kinds email,text,web] [--out <dir>] [--name <stem>] [--eml] [--check]";

interface Args {
  family: string;
  draft: string;
  kinds?: string[];
  out?: string;
  name?: string;
  eml: boolean;
  check: boolean;
}

function usageError(msg: string): never {
  console.error(msg);
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv: string[]): Args {
  const pos: string[] = [];
  const a: Partial<Args> & { eml: boolean; check: boolean } = { eml: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const val = (): string => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) usageError(`missing value for ${t}`);
      return v;
    };
    switch (t) {
      case "--kinds": a.kinds = val().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--out": a.out = val(); break;
      case "--name": a.name = val(); break;
      case "--eml": a.eml = true; break;
      case "--check": a.check = true; break;
      default:
        if (t.startsWith("--")) usageError(`unknown flag ${t}`);
        pos.push(t);
    }
  }
  if (pos.length !== 2) usageError("expected <family> <draft.json>");
  return { ...a, family: pos[0], draft: pos[1] } as Args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.family === "thread") {
    const specPath = path.resolve(args.draft);
    const spec = JSON.parse(readFileSync(specPath, "utf8")) as { slug?: string };
    const stem = args.name ?? String(spec.slug ?? path.basename(specPath, ".json"));
    const outFile = path.join(args.out ? path.resolve(args.out) : path.dirname(specPath), stem + thread.ext);
    const html = await thread.renderFile(specPath);
    if (args.check) { console.log(`would write ${outFile}`); return; }
    mkdirSync(path.dirname(outFile), { recursive: true });
    writeFileSync(outFile, html);
    console.log(outFile);
    return;
  }

  const fam = (FAMILIES as Record<string, (typeof FAMILIES)[keyof typeof FAMILIES]>)[args.family];
  if (!fam) usageError(`unknown family "${args.family}" (known: ${[...Object.keys(FAMILIES), "thread"].join(", ")})`);

  const kinds = (args.kinds ?? [...fam.kinds]) as OutputKind[];
  for (const k of kinds) {
    if (!fam.kinds.includes(k)) usageError(`family "${fam.id}" does not emit kind "${k}" (has: ${fam.kinds.join(", ")})`);
  }

  // Validate the draft.
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(args.draft, "utf8"));
  } catch (e) {
    console.error(`cannot read draft ${args.draft}: ${(e as Error).message}`);
    process.exit(2);
  }
  const parsed = fam.schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`draft failed validation for family "${fam.id}": ${args.draft}`);
    for (const issue of parsed.error.issues) {
      const where = issue.path.length ? issue.path.join(".") : "(root)";
      console.error(`  ${where}: ${issue.message}`);
    }
    process.exit(2);
  }
  const data = parsed.data as Record<string, unknown>;

  // Stem and output folder, per the Python builder for this family.
  const draftStem = path.basename(args.draft).replace(/\.json$/i, "");
  let stem: string;
  let outDir: string;
  if (fam.id === "replycast") {
    stem = String(data.slug);
    outDir = path.dirname(path.resolve(args.draft));
  } else if (fam.id === "plexio") {
    // build_note.py: fixed OUTDIR, independent of the draft's folder.
    stem = draftStem;
    outDir = PLEXIO_OUTDIR;
  } else {
    // Forge-native families (warden, athena): beside the draft; "<name>.<family>.json" -> "<name>".
    stem = draftStem.replace(new RegExp(`\\.${fam.id}$`, "i"), "");
    outDir = path.dirname(path.resolve(args.draft));
  }
  if (args.name) stem = args.name;
  if (args.out) outDir = path.resolve(args.out);

  // Eml needs a sender. Fail before rendering anything.
  let from = "";
  if (args.eml) {
    try {
      from = defaultFrom();
    } catch (e) {
      console.error(`${(e as Error).message}: set FORGE_EML_FROM to the sender address for --eml`);
      process.exit(2);
    }
  }

  // Render everything first so a render failure writes nothing.
  const outputs: { file: string; body: string }[] = [];
  for (const kind of kinds) {
    const body = fam.renderAsync
      ? await fam.renderAsync(parsed.data as never, kind)
      : fam.render(parsed.data as never, kind);
    outputs.push({ file: path.join(outDir, stem + EXT[kind]), body });
  }

  const emailHtml = kinds.includes("email") ? outputs.find((o) => o.file.endsWith(EXT.email))?.body : undefined;
  const emlPath = path.join(outDir, `${stem}.eml`);
  if (args.eml && emailHtml === undefined) {
    console.error("--eml needs the email kind in --kinds");
    process.exit(2);
  }

  if (args.check) {
    if (fam.id === "plexio") console.log(`would build ${stem} (no files written)`);
    for (const o of outputs) console.log(`would write ${o.file}`);
    if (args.eml) console.log(`would write ${emlPath}`);
    return;
  }

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  if (fam.id === "plexio") console.log(`built ${stem}`);
  for (const o of outputs) {
    writeFileSync(o.file, o.body);
    console.log(o.file);
  }
  if (args.eml) {
    const subject = String(data.subject ?? data.slug ?? stem);
    const to = typeof data.to === "string" ? data.to : undefined;
    if (fam.id === "plexio") {
      // build_note.py: multipart/alternative (plain text + HTML), no PDF.
      const text = fam.render(parsed.data as never, "text");
      writeFileSync(emlPath, buildNoteEml({ subject, text, html: emailHtml as string, from, to }));
    } else {
      writeEml(emlPath, { subject, emailHtml: emailHtml as string, from, to });
    }
    console.log(emlPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
