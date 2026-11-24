export {}; // module scope: keeps main() from colliding with other scripts
// Offline check: can each family's generation schema become a structured-output format? No API call.
async function main() {
  const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
  for (const id of ["replycast", "plexio", "warden", "athena"]) {
    const m: any = await import(`../lib/families/${id}/index.ts`);
    const fam = (m.family ?? m.default?.family);
    try {
      const fmt: any = zodOutputFormat(fam.generation.schema);
      const s = JSON.stringify(fmt.schema ?? fmt);
      const flags = {
        bytes: s.length,
        additionalPropsTrue: (s.match(/"additionalProperties":(true|\{\})/g) || []).length,
        anyOf: (s.match(/"anyOf"/g) || []).length,
        oneOf: (s.match(/"oneOf"/g) || []).length,
        patternOrFormat: (s.match(/"(pattern|format)"/g) || []).length,
        minMax: (s.match(/"(minimum|maximum|minLength|maxLength|minItems|maxItems)"/g) || []).length,
      };
      console.log(id, "OK", JSON.stringify(flags));
    } catch (e: any) {
      console.log(id, "THROWS", e.message.slice(0, 200));
    }
  }
}
main();
