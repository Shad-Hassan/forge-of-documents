// Run: npx tsx lib/uploads/selftest.ts
// Writes only under SCR. Never touches data/uploads.
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

// Fresh temp dir per run (was a session scratchpad path, which doesn't survive /clear or reboot).
const SCR = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "forge-uploads-"));
const ROOT = path.join(SCR, "root");

const results: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` :: ${detail}` : ""}`);
}

async function expectErr(name: string, fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    check(name, false, "no error thrown");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    check(name, msg === code, `got ${msg}`);
  }
}

async function main() {
  await fs.rm(ROOT, { recursive: true, force: true });
  await fs.mkdir(ROOT, { recursive: true });
  process.env.FORGE_UPLOADS_ROOT = ROOT;

  const store = await import("./store");
  const { sanitizeName, saveUpload, listUploads, deleteUpload } = store;

  // sanitizeName
  const trav = sanitizeName("../x.txt");
  check("sanitize ../x.txt has no slash and no leading ..", !trav.includes("/") && !trav.startsWith(".."), trav);
  const env = sanitizeName(".env");
  check(".env does not start with a dot", !env.startsWith("."), env);
  const sp = sanitizeName("a b(1).PDF");
  check("a b(1).PDF -> safe name with .pdf", /^[A-Za-z0-9._-]+\.pdf$/.test(sp) && !sp.includes(" "), sp);
  const nul = sanitizeName("ev\0il.txt");
  check("NUL removed", !nul.includes("\0") && nul === "evil.txt", nul);
  const bs = sanitizeName("..\\..\\win.txt");
  check("backslash traversal stripped", !bs.includes("\\") && !bs.includes(".."), bs);
  check("empty becomes file", sanitizeName("---") === "file", sanitizeName("---"));

  // save txt
  const first = await saveUpload("notes.txt", Buffer.from("hello one"));
  check("save notes.txt", first.path === "notes.txt" && first.bytes === 9, JSON.stringify(first));

  const before = (await listUploads()).length;
  const dup = await saveUpload("notes.txt", Buffer.from("hello one"));
  const after = (await listUploads()).length;
  check("same bytes dedupe to same path", dup.path === first.path, dup.path);
  check("dedupe creates no new file", before === after, `${before} -> ${after}`);

  const other = await saveUpload("notes.txt", Buffer.from("different bytes"));
  check("different bytes same name gets -2", other.path === "notes-2.txt", other.path);

  await expectErr("exe is UNSUPPORTED_TYPE", () => saveUpload("evil.exe", Buffer.from("MZ")), "UNSUPPORTED_TYPE");
  await expectErr("fake pdf is BAD_CONTENT", () => saveUpload("fake.pdf", Buffer.from("hello")), "BAD_CONTENT");
  await expectErr(
    "oversize is TOO_LARGE",
    () => saveUpload("big.txt", Buffer.alloc(50 * 1024 * 1024 + 1, 97)),
    "TOO_LARGE",
  );

  // docx with sidecar
  const docxAbs = path.join(SCR, "forge-sidecar-test.docx");
  const py = [
    "import zipfile,sys",
    "z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED)",
    "z.writestr('[Content_Types].xml','<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>')",
    "z.writestr('_rels/.rels','<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>')",
    "z.writestr('word/document.xml','<?xml version=\"1.0\" encoding=\"UTF-8\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>forge sidecar test</w:t></w:r></w:p></w:body></w:document>')",
    "z.close()",
  ].join("\n");
  execFileSync("python3", ["-I", "-c", py, docxAbs]);
  const docxBytes = await fs.readFile(docxAbs);

  const docx = await saveUpload("forge-sidecar-test.docx", docxBytes);
  check("docx has sidecar", Boolean(docx.sidecar), JSON.stringify(docx));
  const sidecarText = docx.sidecar ? await fs.readFile(path.join(ROOT, docx.sidecar), "utf8") : "";
  check("sidecar contains text", sidecarText.includes("forge sidecar test"), sidecarText.slice(0, 120));

  const listed = await listUploads();
  check("listUploads excludes sidecars", listed.every((f) => !f.path.endsWith(".docx.txt")), listed.map((f) => f.path).join(","));
  check("listUploads flags docx sidecar", listed.some((f) => f.path === docx.path && f.sidecar === true));

  await expectErr("traversal delete is FORBIDDEN", () => deleteUpload("../../etc/hostname"), "FORBIDDEN");
  await expectErr("sidecar delete is FORBIDDEN", () => deleteUpload(docx.sidecar!), "FORBIDDEN");
  await expectErr("missing delete is NOT_FOUND", () => deleteUpload("nope.txt"), "NOT_FOUND");

  await deleteUpload(docx.path);
  const sidecarGone = await fs.access(path.join(ROOT, docx.sidecar!)).then(() => false, () => true);
  check("deleting docx removes its sidecar", sidecarGone);
}

main()
  .then(() => {
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.log("FAIL selftest crashed :: " + (err instanceof Error ? err.stack : String(err)));
    process.exit(1);
  });
