// Block draft for the warden email family. Each block variant's fields are the Python
// warden_email function's parameters, by name. raw is the exception noted in the port report.
import { z } from "zod";
import { PILL_KINDS } from "./email";

const Fact = z.tuple([z.union([z.string(), z.number()]), z.string()]);

const HeroBlock = z.object({
  type: z.literal("hero"),
  kicker: z.string(),
  h1: z.string(),
  lede: z.string(),
  facts: z.array(Fact),
  extra: z.string().optional(),
});

const HeadingBlock = z.object({
  type: z.literal("heading"),
  text: z.string(),
  intro: z.string().optional(),
});

const TextBlock = z.object({
  type: z.literal("text"),
  s: z.string(),
  size: z.number().optional(),
  color: z.string().optional(),
  weight: z.number().optional(),
  pad: z.string().optional(),
});

const TileBlock = z.object({
  type: z.literal("tile"),
  inner: z.string(),
  top: z.string().optional(),
  pad: z.string().optional(),
});

const PillBlock = z.object({
  type: z.literal("pill"),
  kind: z.enum(PILL_KINDS),
});

const LinksBlock = z.object({
  type: z.literal("links"),
  url: z.string(),
  pdf_name: z.string(),
});

const RawBlock = z.object({
  type: z.literal("raw"),
  text: z.string(),
  dark: z.boolean().optional(),
  tag: z.string().optional(),
});

export const blockSchema = z.discriminatedUnion("type", [
  HeroBlock,
  HeadingBlock,
  TextBlock,
  TileBlock,
  PillBlock,
  LinksBlock,
  RawBlock,
]);

export const schema = z.object({
  subject: z.string(),
  preheader: z.string().optional(),
  title: z.string(),
  blocks: z.array(blockSchema),
});

export type Draft = z.infer<typeof schema>;
