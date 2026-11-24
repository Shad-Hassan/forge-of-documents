export {}; // module scope: keeps main() from colliding with other scripts
// Token contrast check for the TS families (replaces `python3 athena_base.py --check` and
// `python3 warden_base.py --check` now that TypeScript is the renderer). Same output text as Python.
//   npx tsx scripts/tokencheck.ts [athena|warden]     (default: both). Exit 0 = PASS.
async function main() {
  const which = process.argv[2];
  let code = 0;
  if (!which || which === "athena") {
    console.log("athena");
    const a = await import("../lib/families/athena/base");
    code ||= (a.check ?? (a as any).default.check)();
  }
  if (!which || which === "warden") {
    console.log("warden");
    const w = await import("../lib/families/warden/base");
    const r = (w.check ?? (w as any).default.check)() as { lines: string[]; ok?: boolean; code?: number };
    for (const l of r.lines) console.log(l);
    const failed = r.ok === false || (typeof r.code === "number" && r.code !== 0) || r.lines.some((l) => /\bFAIL\b/.test(l));
    if (failed) code = 1;
  }
  process.exit(code);
}
main();
