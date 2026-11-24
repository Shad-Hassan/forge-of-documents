// Draft JSON accepted by replyCast/build.py (render path: render(), block(), table(), urlmap()).
// Every optional key below is one build.py reads with d.get(...) or t.get(...) and tolerates when absent.
// build.py ignores unknown keys, so every object is .passthrough().
import { z } from "zod";

/** Tone keys, in TONES dict order. block() picks the first key present in this order. */
export const TONE_ORDER = ["warn", "danger", "ok", "reach", "info", "ask", "danger-soft", "orange", "go"] as const;
const tone = z.enum(TONE_ORDER);

const urlmap = z
  .object({
    title: z.string(),
    // Record from draft files; ordered pairs from the generation path (keeps integer-like keys in order).
    items: z.union([z.record(z.string(), z.string()), z.array(z.tuple([z.string(), z.string()]))]),
    empty: z.string().optional(),
  })
  .passthrough();

const table = z
  .object({
    head: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    highlight: z.array(z.number().int()).optional(),
    row_tones: z.array(z.union([z.literal(""), tone])).optional(),
    tone: z.union([z.literal(""), tone]).optional(),
    stamp: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((t, ctx) => {
    // table() reads r[2] for every row and head[j] for every cell past the third.
    t.rows.forEach((r, i) => {
      if (r.length < 3) {
        ctx.addIssue({ code: "custom", message: `rows[${i}] needs at least 3 cells`, path: ["rows", i] });
      }
      for (let j = 3; j < r.length; j++) {
        if (j >= t.head.length) {
          ctx.addIssue({ code: "custom", message: `head has no label for rows[${i}][${j}]`, path: ["head"] });
        }
      }
    });
  });

// Dispatch order matches block(): lead, tag, urls, h1, h2, h3, p, shot, table, then tone keys.
const lead = z.object({ lead: z.string(), url: z.string().optional() }).passthrough();
const tag = z.object({ tag: z.string() }).passthrough();
const urls = z.object({ urls: urlmap }).passthrough();
const h1 = z.object({ h1: z.string() }).passthrough();
const h2 = z.object({ h2: z.string() }).passthrough();
const h3 = z.object({ h3: z.string() }).passthrough();
const p = z.object({ p: z.string() }).passthrough();
const shot = z.object({ shot: z.string(), caption: z.string().optional() }).passthrough();
const tbl = z.object({ table }).passthrough();
const toneBlocks = TONE_ORDER.map((k) =>
  z.object({ [k]: z.string(), icon: z.string().optional() }).passthrough(),
);

export const block = z.union([lead, tag, urls, h1, h2, h3, p, shot, tbl, ...toneBlocks]);

export const schema = z
  .object({
    slug: z.string(),
    subject: z.string().optional(),
    greeting: z.string().optional(),
    blocks: z.array(block),
    signoff: z.string().optional(),
    name: z.string().optional(),
    after: z.array(block).optional(),
  })
  .passthrough();

export type Draft = z.infer<typeof schema>;
