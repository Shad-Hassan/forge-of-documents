// Renders each fixture in TypeScript and compares it with the Python golden output in __golden__/.
// Run: npx tsx lib/visuals/golden.ts   (exit 0 only if every case prints IDENTICAL)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as flowmode from "./flowmode";
import * as wflow from "./warden-flow";
import * as world from "./warden-world";

const GOLD = join(__dirname, "__golden__");

function gold(name: string): string {
  return readFileSync(join(GOLD, name), "utf8");
}

function compare(name: string, got: string): boolean {
  const want = gold(name);
  if (got === want) {
    console.log(`${name}: IDENTICAL`);
    return true;
  }
  let i = 0;
  while (i < got.length && i < want.length && got[i] === want[i]) i++;
  console.log(`${name}: DIFF at char ${i} (ts length ${got.length}, py length ${want.length})`);
  console.log(`  ts: ${JSON.stringify(got.slice(i, i + 200))}`);
  console.log(`  py: ${JSON.stringify(want.slice(i, i + 200))}`);
  return false;
}

interface RealCase { key: string; src: string; path: string; label: string; nonascii: boolean }

function realCases(): boolean[] {
  const manifest = JSON.parse(gold("real/manifest.json")) as RealCase[];
  const out: boolean[] = [];
  for (const c of manifest) {
    const input = JSON.parse(readFileSync(join(GOLD, "real", "inputs", `${c.key}.json`), "utf8")) as {
      label: string; lanes: flowmode.FlowLane[]; edges: flowmode.FlowEdge[];
    };
    const flow = flowmode.layout(input.lanes, input.edges);
    const tag = `real/${c.key}`;
    out.push(compare(`${tag}.flowmode.svg`, flowmode.svg(flow)));
    out.push(compare(`${tag}.cosmic.svg`, wflow.svg(flow, input.label, "cosmic", `flow-cosmic-${c.key}`)));
    out.push(compare(`${tag}.print.svg`, wflow.svg(flow, input.label, "print", `flow-print-${c.key}`)));
    out.push(compare(`${tag}.email.json`, JSON.stringify(wflow.emailSteps(flow))));
  }
  return out;
}

function main(): void {
  const input = JSON.parse(gold("flow.json")) as { lanes: flowmode.FlowLane[]; edges: flowmode.FlowEdge[] };
  const flow = flowmode.layout(input.lanes, input.edges);
  const results: boolean[] = [
    compare("flowmode.svg", flowmode.svg(flow)),
    compare("warden_flow.cosmic.svg", wflow.svg(flow, "Golden flow", "cosmic", "wf-golden")),
    compare("warden_flow.print.svg", wflow.svg(flow, "Golden flow", "print", "wf-golden")),
    compare("warden_flow.email.json", JSON.stringify(wflow.emailSteps(flow))),
    compare("warden_world.citadel.svg", world.citadel()),
    compare("warden_world.shards.svg", world.shards()),
    compare("warden_world.foundation.svg", world.foundation()),
    compare("warden_world.core_glyph.svg", world.coreGlyph()),
  ];
  results.push(...realCases());
  const allOk = results.every(Boolean);
  console.log(allOk ? "ALL IDENTICAL" : "SOME CASES DIFF");
  process.exitCode = allOk ? 0 : 1;
}

main();
