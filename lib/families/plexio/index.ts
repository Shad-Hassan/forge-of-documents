// plexio family: /plexio note mode (short emails). Ports artifactHtml/src/build_note.py.
// Kinds: email -> render_html, text -> render_text, web -> artifact_page.
import type { Family, OutputKind } from "../../engine/types";
import { schema, type NoteDraft } from "./schema";
import { renderHtml, renderText, artifactPage, inlineRemoteImages } from "./render";
import { generationSchema, toDraft } from "./generation";

export const family: Family<typeof schema> = {
  id: "plexio",
  portedFrom: ["artifactHtml/src/build_note.py"],
  schema,
  generation: { schema: generationSchema, toDraft },
  kinds: ["email", "text", "web"],
  render(input: NoteDraft, kind: OutputKind): string {
    switch (kind) {
      case "email":
        return renderHtml(input);
      case "text":
        return renderText(input);
      case "web":
        return artifactPage(renderHtml(input), input);
      default:
        throw new Error(`plexio: kind "${kind}" not supported`);
    }
  },
  async renderAsync(input: NoteDraft, kind: OutputKind): Promise<string> {
    if (kind !== "web") return this.render(input, kind);
    return inlineRemoteImages(artifactPage(renderHtml(input), input, { allowRemote: true }));
  },
};
