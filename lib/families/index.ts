import type { Family, FamilyId } from "../engine/types";
import { family as replycast } from "./replycast";
import { family as plexio } from "./plexio";
import { family as warden } from "./warden";
import { family as athena } from "./athena/index";

// Doc-store families (Claude can generate, editor can edit). `thread` is CLI-only: see scripts/forge-render.ts.
export const FAMILIES: Record<FamilyId, Family> = { replycast, plexio, warden, athena };

export const FAMILY_LABELS: Record<FamilyId, { name: string; blurb: string; gen: number }> = {
  replycast: { name: "replyCast", blurb: "Email reply, exactly as written", gen: 1 },
  plexio: { name: "plexio", blurb: "Note, report or email, house style", gen: 1 },
  warden: { name: "warden", blurb: "Internal brief, frost print", gen: 1 },
  athena: { name: "athena", blurb: "Bento command center, Athens Gray", gen: 3 },
};
