// Claude Engine of Artifact: the render contract.
// Every family and every template conforms to these types. Do not change them inside a family port.
import type { z } from "zod";

/** Artifact generation, per ~/.claude/CLAUDE.md: 0 plain, 1 fine control, 2 cinematic, 3 templates. */
export type Gen = 0 | 1 | 2 | 3;

/** The output surfaces one build can produce. */
export type OutputKind =
  | "web" //   publishable HTML artifact (.html)
  | "print" // HTML for the PDF printer (.print.html)
  | "email" // table-only, inline-style email HTML (.email.html)
  | "text" //   plain-text email body (.txt)
  | "paste"; //  paste-ready HTML fragment (.paste.html), replyCast only

export type FamilyId = "replycast" | "plexio" | "warden" | "athena";
/** Renderers outside the doc store (no Claude generation, input is a file path). CLI only. */
export type RendererId = FamilyId | "thread";

/**
 * A family = one Python base ported to TypeScript.
 * `schema` validates EXACTLY the draft JSON shape the Python builder already consumes.
 * `render` is pure: same input -> same string, no I/O, no Date.now(), no randomness.
 */
export interface Family<S extends z.ZodTypeAny = z.ZodTypeAny> {
  id: FamilyId;
  /** Python source this family ports, for provenance. */
  portedFrom: string[];
  schema: S;
  /** Kinds this family can emit. render() throws for any other kind. */
  kinds: readonly OutputKind[];
  render(input: z.infer<S>, kind: OutputKind): string;
  /** Optional: render plus I/O the pure render can't do (e.g. plexio inlines remote images). Forge prefers it. */
  renderAsync?(input: z.infer<S>, kind: OutputKind): Promise<string>;
  /**
   * What Claude fills via structured output (messages.parse + zodOutputFormat).
   * `schema` is strict (every node typed, no passthrough/record/tuple/any), so it converts to a
   * structured-output JSON schema. `toDraft` maps its output into the renderer contract above;
   * the result must pass `Family.schema`.
   */
  generation?: {
    schema: z.ZodTypeAny;
    toDraft(out: unknown): z.infer<S>;
  };
}

/** Recorded in <name>.meta.json, as artifact_gate.py requires. */
export interface ArtifactMeta {
  style: string;
  generation: Gen;
}
