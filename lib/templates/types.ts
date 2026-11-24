import type { FamilyId, Gen } from "../engine/types";

export interface DocumentDial {
  name: string;
  key: string;
  type: "select" | "text" | "number" | "slider";
  options?: string[];
  min?: number;
  max?: number;
  default?: string | number;
  placeholder?: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  dials: DocumentDial[];
  systemPrompt: string;
  /** Defaults to 0 (plain markdown output, no family renderer). */
  gen?: Gen;
  /**
   * When set, Claude must emit the family's draft JSON via forced tool use,
   * and the family renders it. When unset, Claude returns plain text (Gen 0).
   */
  family?: FamilyId;
  /** Written to .meta.json `style`. Defaults to the family id, or "plain". */
  style?: string;
}
