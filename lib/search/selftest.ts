import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

// tsx compiles this as CJS: no top-level await. Everything runs inside main().

const APP = "/home/shad/Titanium_X_00/Forge-of-Documents-II/app";
// Fresh temp dir per run (was a session scratchpad path, which doesn't survive /clear or reboot).
const SCR = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "forge-search-"));
const CORPUS = "/home/shad/Documents/0_CurrentSessionDocuments/artifactHtml";
const GREP = "/usr/bin/grep";
const PDFTOTEXT = "/usr/bin/pdftotext";
const TSX = path.join(APP, "node_modules/.bin/tsx");
const TEXTCACHE = path.join(SCR, "textcache");
const FAKEROOT = path.join(SCR, "fakeroot");

const run = promisify(execFile);
let failures = 0;

function report(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " -- " + detail : ""}`);
  if (!ok) failures++;
}

async function errorOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "NO THROW";
  } catch (err: any) {
    return String(err?.message ?? err);
  }
}

async function plainGrepFiles(pattern: string): Promise<string[]> {
  try {
    const { stdout } = await run(GREP, ["-r", "-i", "-l", "-I", "-F", "--", pattern, CORPUS], {
      maxBuffer: 20 * 1024 * 1024,
    });
    return stdout.split("\n").filter(Boolean);
  } catch (err: any) {
    if (err?.code === 1) return [];
    throw err;
  }
}

// Child mode: runs with FORGE_ARTIFACTS_ROOT pointing at the fake root.
async function symlinkMode(): Promise<void> {
  const { read } = await import("./index");
  let ok = true;
  const escape = await errorOf(() => read({ path: "artifacts:evil" }));
  const escapeOk = escape.startsWith("FORBIDDEN");
  console.log(`${escapeOk ? "PASS" : "FAIL"} e-symlink read(artifacts:evil) -- ${escape}`);
  ok = ok && escapeOk;
  const plain = await read({ path: "artifacts:a.txt" }).catch((e: Error) => e);
  const plainOk = !(plain instanceof Error) && plain.text.includes("hello from fakeroot");
  console.log(`${plainOk ? "PASS" : "FAIL"} e-symlink read(artifacts:a.txt) works`);
  ok = ok && plainOk;
  process.exitCode = ok ? 0 : 1;
}

async function main(): Promise<void> {
  if (process.argv[2] === "--symlink") return symlinkMode();

  // Fresh text cache inside SCR so the first sync really extracts. Never inside APP.
  fs.rmSync(TEXTCACHE, { recursive: true, force: true });
  process.env.FORGE_TEXTCACHE = TEXTCACHE;
  const { search, read, list } = await import("./index");
  const cache = await import("./cache");

  // Timing and PDF cache.
  const t0 = Date.now();
  const s1 = await cache.syncPdfCache("artifacts");
  const ms = Date.now() - t0;
  report(
    "pdf cache first sync extracts",
    s1.extracted + s1.fresh > 0 && s1.extracted > 0,
    `extracted=${s1.extracted} fresh=${s1.fresh} total=${s1.extracted + s1.fresh} ms=${ms}`,
  );
  const s2 = await cache.syncPdfCache("artifacts");
  report("pdf cache second sync extracts 0", s2.extracted === 0, `extracted=${s2.extracted} fresh=${s2.fresh}`);

  // a) rentcast
  const hitsA = await search({ pattern: "rentcast", roots: ["artifacts"], limit: 50 });
  const plainA = await plainGrepFiles("rentcast");
  report(
    "a) rentcast search returns files",
    hitsA.length > 0,
    `search files=${hitsA.length}, plain grep -l files=${plainA.length}`,
  );

  // b) PDF-only word
  // The first PDF whose text has a word (or a 2-word phrase) found in no non-PDF file.
  // Most PDFs are rendered from HTML that also exists in the corpus, so the first one may not qualify.
  const pdfs = fs.readdirSync(CORPUS).filter((n) => /\.pdf$/i.test(n)).sort();
  let pdfName = "";
  let chosen: string | null = null;
  let phrase = false;
  let tries = 0;
  for (const name of pdfs) {
    const text = (await run(PDFTOTEXT, ["-layout", path.join(CORPUS, name), "-"], { maxBuffer: 50 * 1024 * 1024 }))
      .stdout;
    const freq = new Map<string, number>();
    for (const w of text.match(/[A-Za-z]{8,}/g) ?? []) {
      const k = w.toLowerCase();
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    // Rarest-in-PDF first: a distinctive term is more likely to be PDF-only.
    const candidates = [...freq.keys()].sort(
      (x, y) => freq.get(x)! - freq.get(y)! || y.length - x.length || x.localeCompare(y),
    );
    let perPdfTries = 0;
    for (const w of candidates) {
      if (perPdfTries >= 5) break;
      perPdfTries++;
      tries++;
      if ((await plainGrepFiles(w)).filter((f) => !/\.pdf$/i.test(f)).length === 0) {
        chosen = w;
        break;
      }
    }
    if (!chosen) {
      // Fallback: two adjacent words from one line of the PDF text.
      for (const line of text.split("\n")) {
        const m = /([A-Za-z]{8,}) ([A-Za-z]{8,})/.exec(line);
        if (m && (await plainGrepFiles(m[0])).filter((f) => !/\.pdf$/i.test(f)).length === 0) {
          chosen = m[0];
          phrase = true;
          break;
        }
      }
    }
    if (chosen) {
      pdfName = name;
      break;
    }
  }
  if (!chosen) {
    report("b) PDF-only word found", false, `no word in ${pdfs.length} PDFs, ${tries} tries`);
  } else {
    const hitsB = await search({ pattern: chosen, roots: ["artifacts"], limit: 50 });
    const pdfHit = hitsB.find((h) => h.path === pdfName && h.root === "artifacts");
    const cacheLeak = hitsB.some((h) => h.path.endsWith(".txt"));
    report(
      "b) PDF search returns the PDF",
      !!pdfHit && !cacheLeak,
      `${phrase ? "phrase" : "word"}="${chosen}" tries=${tries} pdf=${pdfName} hits=${hitsB.length}`,
    );
  }

  // c) read line window
  const rc = await read({ path: "artifacts:INDEX.md", from: 1, to: 5 });
  report(
    "c) read INDEX.md 1..5",
    rc.text.split("\n").length === 5 && rc.totalLines > 5,
    `lines=${rc.text.split("\n").length} totalLines=${rc.totalLines}`,
  );

  // d) html read has no tags
  const htmlName = fs.readdirSync(CORPUS).filter((n) => n.endsWith(".html")).sort()[0];
  const rd = await read({ path: `artifacts:${htmlName}`, from: 1, to: 800 });
  const hasTag = /<\/?[a-zA-Z!][^>]*>/.test(rd.text);
  report("d) html read has no tag characters", rd.text.length > 0 && !hasTag, `file=${htmlName} chars=${rd.text.length}`);

  // e) escapes
  for (const p of ["artifacts:../.bashrc", "artifacts:/etc/passwd", "nope:INDEX.md"]) {
    const msg = await errorOf(() => read({ path: p }));
    report(`e) escape ${p}`, msg.startsWith("FORBIDDEN"), msg);
  }
  fs.mkdirSync(FAKEROOT, { recursive: true });
  fs.writeFileSync(path.join(FAKEROOT, "a.txt"), "hello from fakeroot\n");
  const evil = path.join(FAKEROOT, "evil");
  try {
    fs.lstatSync(evil);
  } catch {
    fs.symlinkSync("/etc/hostname", evil);
  }
  try {
    const child = await run(TSX, [__filename, "--symlink"], {
      cwd: APP,
      env: { ...process.env, FORGE_ARTIFACTS_ROOT: FAKEROOT, FORGE_TEXTCACHE: TEXTCACHE },
      maxBuffer: 5 * 1024 * 1024,
    });
    process.stdout.write(child.stdout);
    report("e) symlink escape child", true);
  } catch (err: any) {
    process.stdout.write(String(err?.stdout ?? ""));
    report("e) symlink escape child", false, String(err?.stderr ?? err?.message).slice(0, 300));
  }

  // f) injection
  const hitsF = await search({ pattern: "--version", roots: ["artifacts"], limit: 50 });
  const leaked = hitsF.some((h) => h.snippets.some((s) => /GNU grep|ugrep/i.test(s.text)));
  report("f) --version searched literally", !leaked, `hits=${hitsF.length}`);

  // g) list with meta titles
  const entries = await list({ dir: "artifacts:" });
  const titled = entries.filter((e) => e.title !== undefined);
  report("g) list returns titled entries", entries.length > 0 && titled.length > 0, `entries=${entries.length} titled=${titled.length}`);

  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.log(`FAIL selftest crashed -- ${err?.stack ?? err}`);
  process.exitCode = 1;
});
