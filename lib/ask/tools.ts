// The search contract (lib/search) exposed to Claude as runnable tools.
// Every hit comes back as a search_result block with citations on, so answers cite file + passage.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaSearchResultBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { list, read, search } from "../search";

const MAX_BLOCK_CHARS = 4000;

function block(source: string, title: string, texts: string[]): BetaSearchResultBlockParam {
  return {
    type: "search_result",
    source,
    title,
    content: texts.filter((t) => t.trim()).map((text) => ({ type: "text", text })),
    citations: { enabled: true },
  };
}

/** Split long text into ~paragraph blocks so citations point at a passage, not a whole file. */
function chunks(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const para of text.split(/\n{2,}/)) {
    if (cur && cur.length + para.length > MAX_BLOCK_CHARS) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  if (cur) out.push(cur);
  return out;
}

export const searchTool = betaZodTool({
  name: "search",
  description:
    "Case-insensitive text search across the artifact library and uploads (HTML artifacts, build drafts JSON, .meta.json files, Markdown, PDFs). Returns matching files with line snippets. Use specific terms: names, project names, unusual words. Search again with other terms if results are thin.",
  inputSchema: z.object({
    pattern: z.string().min(2).describe("Literal text to find (or a regex when regex=true)."),
    glob: z.string().optional().describe('Optional file filter, e.g. "*.json" or "*.pdf".'),
    regex: z.boolean().optional(),
    limit: z.number().int().min(1).max(50).optional().describe("Max files, default 20."),
  }),
  run: async (input) => {
    const hits = await search(input);
    if (!hits.length) return `No matches for "${input.pattern}".`;
    return hits.map((h) =>
      block(`${h.root}:${h.path}`, h.title, h.snippets.map((s) => `L${s.line}: ${s.text}`)),
    );
  },
});

export const readTool = betaZodTool({
  name: "read",
  description:
    'Read a file found by search or list. path is "<root>:<relative path>" exactly as search returned it as source, e.g. "artifacts:INDEX.md". Optional 1-based line window (default 1-400).',
  inputSchema: z.object({
    path: z.string(),
    from: z.number().int().min(1).optional(),
    to: z.number().int().min(1).optional(),
  }),
  run: async (input) => {
    const r = await read(input);
    const head = `${r.title} (lines ${r.from}-${r.to} of ${r.totalLines})`;
    return [block(`${r.root}:${r.path}`, head, chunks(r.text))];
  },
});

export const listTool = betaZodTool({
  name: "list",
  description:
    'List a folder (non-recursive) with titles, style, generation and audience from .meta.json. dir is "<root>:<relative dir>", default "artifacts:". Roots: artifacts, uploads.',
  inputSchema: z.object({
    dir: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  run: async (input) => JSON.stringify(await list(input)),
});

export const ASK_TOOLS = [searchTool, readTool, listTool];
