import type { TemplateDef } from "../types";

export const proposal: TemplateDef = {
  id: "proposal",
  name: "Proposal",
  description: "Project or business proposal",
  dials: [
    {
      name: "Scope",
      key: "scope",
      type: "text",
      placeholder: "e.g., SaaS platform redesign",
    },
    {
      name: "Budget Range",
      key: "budget",
      type: "select",
      options: ["$5-10K", "$10-50K", "$50-100K", "$100K+"],
      default: "$10-50K",
    },
    {
      name: "Timeline",
      key: "timeline",
      type: "select",
      options: ["1 month", "3 months", "6 months", "1 year"],
      default: "3 months",
    },
    {
      name: "Target Audience",
      key: "audience",
      type: "text",
      placeholder: "e.g., C-suite, product team",
    },
  ],
  systemPrompt: `You are an expert proposal writer. Generate compelling, structured proposals.
Include executive summary, scope, timeline, deliverables, and pricing sections.
Use clear language and logical flow. Focus on value and outcomes.`,
};
