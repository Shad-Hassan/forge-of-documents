// Generation schema for the athena web family: what Claude fills via structured output.
// Strict everywhere (no record, tuple, any, passthrough). Edges are objects, not tuples. Validation of
// src and edge endpoints happens in schema.ts (toDraft runs it), not here.
import { z } from "zod";
import { FLOW_KINDS, schema, SPANS, STATUSES, TONES, type Draft } from "./schema";

const flowNode = z.strictObject({
  id: z.string().describe("Unique node id, referenced by edges."),
  kind: z.enum(FLOW_KINDS).describe("start, manual, hold, decision or target."),
  title: z.string().describe("Node title."),
  sub: z.string().optional().describe("Small detail under the title."),
  tag: z.string().optional().describe("Small tag above the title. Omit when the source has none."),
});

const block = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("header"),
    eyebrow: z.string().optional().describe("Small uppercase label above the title."),
    title: z.string().describe("Page title (h1)."),
    lede: z.string().optional().describe("One-line lede under the title. Supports **bold** and `code`."),
  }),
  z.strictObject({
    type: z.literal("stats"),
    items: z
      .array(
        z.strictObject({
          value: z.string().describe("Figure as text, already computed."),
          label: z.string().describe("Figure label."),
          note: z.string().optional().describe("Small text under the figure. Supports **bold** and `code`."),
        }),
      )
      .describe("Stat tiles, four across, in display order."),
  }),
  z.strictObject({
    type: z.literal("section"),
    title: z.string().describe("Section heading (h2), drawn as a divider between tiles."),
  }),
  z.strictObject({
    type: z.literal("tile"),
    title: z.string().optional().describe("Tile heading (h3). Omit when the source has none."),
    body: z.array(z.string()).describe("Body paragraphs. Supports **bold** and `code`."),
    list: z.array(z.string()).optional().describe("Optional bullet list under the body."),
    span: z.enum(SPANS).optional().describe("Columns of a 3-column row: 1 third, 2 two thirds, 3 full row. Default 3."),
  }),
  z.strictObject({
    type: z.literal("image"),
    src: z.string().describe("A data:image/png|jpeg|gif|webp;base64 URI, or an https URL with no '&'."),
    alt: z.string().describe("Alt text."),
    caption: z.string().optional().describe("Caption under the image. Supports **bold** and `code`."),
    span: z.enum(SPANS).optional().describe("1 third, 2 two thirds, 3 full row. Default 3."),
  }),
  z.strictObject({
    type: z.literal("flow"),
    title: z.string().optional().describe("Optional tile title."),
    lanes: z
      .array(
        z.strictObject({
          label: z.string().optional().describe("Lane label, shown top right. Omit when the source has none."),
          nodes: z.array(flowNode).describe("Nodes in this lane, left to right."),
        }),
      )
      .describe("Lanes, top to bottom."),
    edges: z
      .array(
        z.strictObject({
          from: z.string().describe("Source node id."),
          to: z.string().describe("Target node id."),
          label: z.string().describe("Edge label, or an empty string for none."),
        }),
      )
      .describe("Arrows between nodes."),
  }),
  z.strictObject({
    type: z.literal("table"),
    head: z.array(z.string()).describe("Column headers."),
    rows: z.array(z.array(z.string())).describe("Rows of cell text, same width as head. Cells support **bold** and `code`."),
  }),
  z.strictObject({
    type: z.literal("list"),
    items: z
      .array(
        z.strictObject({
          text: z.string().describe("Item text. Supports **bold** and `code`."),
          status: z.enum(STATUSES).optional().describe("ok, warn or risk. Shown as a dot plus a text label."),
        }),
      )
      .describe("List rows."),
  }),
  z.strictObject({
    type: z.literal("callout"),
    tone: z.enum(TONES).describe("info, warn or ok."),
    text: z.string().describe("Callout text. Supports **bold** and `code`."),
  }),
  z.strictObject({
    type: z.literal("seal"),
    // Only when the source states who, source and date: never invent a seal.
    who: z.string().describe("Who wrote the page, exactly as the source states it. Omit the whole seal block if the source doesn't say."),
    source: z.string().describe("Source the figures come from."),
    date: z.string().describe("Date, ISO YYYY-MM-DD."),
    version: z.string().describe("Page version, as text."),
  }),
]);

export const generationSchema = z.strictObject({
  title: z.string().describe("Document title."),
  blocks: z.array(block).describe("Page blocks, rendered in order."),
});

export type Generation = z.infer<typeof generationSchema>;

/** Maps generation output to the renderer draft; schema.parse also checks image src. */
export function toDraft(out: unknown): Draft {
  return schema.parse(generationSchema.parse(out));
}
