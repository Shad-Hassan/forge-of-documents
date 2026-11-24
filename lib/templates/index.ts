import type { TemplateDef } from "./types";
import { email } from "./email/template";
import { proposal } from "./proposal/template";
import { report } from "./report/template";
import { brief } from "./brief/template";
import { caseStudy } from "./case-study/template";

// Every template is registered here. Adding one = a new folder + one line below.
const templates = [email, proposal, report, brief, caseStudy] as const;

export type DocumentType = (typeof templates)[number]["id"];

export type { DocumentDial } from "./types";

export type DocumentConfig = TemplateDef;

export const documentTypes = Object.fromEntries(
  templates.map((t) => [t.id, t])
) as Record<DocumentType, TemplateDef>;
