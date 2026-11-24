// Renderer contract for the athena web family: { title, blocks } with a discriminated union on "type".
// Text fields accept inline **bold** and `code` (escaped first, then converted). No colours here: colour is a token.
import { z } from "zod";

export const TONES = ["info", "warn", "ok"] as const;
export const STATUSES = ["ok", "warn", "risk"] as const;
export const SPANS = ["1", "2", "3"] as const;
export const FLOW_KINDS = ["start", "manual", "hold", "decision", "target"] as const;

/** data: URI of a raster image (base64), or an https URL with no ampersand (the inliner cannot escape it). */
export function validImageSrc(s: string): boolean {
  if (/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return true;
  return /^https:\/\/[^\s"<>&]+$/.test(s);
}
export const IMAGE_SRC_MESSAGE = "image src must be a data:image/(png|jpeg|gif|webp);base64 URI or an https URL without '&'";

const HeaderBlock = z.object({
  type: z.literal("header"),
  eyebrow: z.string().optional(),
  title: z.string(),
  lede: z.string().optional(),
});

const StatsBlock = z.object({
  type: z.literal("stats"),
  items: z.array(z.object({ value: z.string(), label: z.string(), note: z.string().optional() })),
});

const SectionBlock = z.object({
  type: z.literal("section"),
  title: z.string(),
});

const TileBlock = z.object({
  type: z.literal("tile"),
  title: z.string().optional(),
  body: z.array(z.string()),
  list: z.array(z.string()).optional(),
  span: z.enum(SPANS).optional(),
});

const ImageBlock = z.object({
  type: z.literal("image"),
  src: z.string().refine(validImageSrc, { message: IMAGE_SRC_MESSAGE }),
  alt: z.string(),
  caption: z.string().optional(),
  span: z.enum(SPANS).optional(),
});

const FlowBlock = z.object({
  type: z.literal("flow"),
  title: z.string().optional(),
  lanes: z.array(
    z.object({
      label: z.string().optional(),
      nodes: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(FLOW_KINDS),
          title: z.string(),
          sub: z.string().optional(),
          tag: z.string().optional(),
        }),
      ),
    }),
  ),
  edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string() })),
});

const TableBlock = z.object({
  type: z.literal("table"),
  head: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const ListBlock = z.object({
  type: z.literal("list"),
  items: z.array(z.object({ text: z.string(), status: z.enum(STATUSES).optional() })),
});

const CalloutBlock = z.object({
  type: z.literal("callout"),
  tone: z.enum(TONES),
  text: z.string(),
});

const SealBlock = z.object({
  type: z.literal("seal"),
  who: z.string(),
  source: z.string(),
  date: z.string(),
  version: z.string(),
});

export const blockSchema = z.discriminatedUnion("type", [
  HeaderBlock,
  StatsBlock,
  SectionBlock,
  TileBlock,
  ImageBlock,
  FlowBlock,
  TableBlock,
  ListBlock,
  CalloutBlock,
  SealBlock,
]);

export const schema = z.object({
  title: z.string(),
  blocks: z.array(blockSchema),
});

export type Draft = z.infer<typeof schema>;
export type Block = Draft["blocks"][number];
