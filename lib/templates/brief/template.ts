import type { TemplateDef } from "../types";

export const brief: TemplateDef = {
  id: "brief",
  name: "Brief",
  description: "Executive summary or briefing",
  dials: [
    {
      name: "Topic",
      key: "topic",
      type: "text",
      placeholder: "e.g., market opportunity analysis",
    },
    {
      name: "Length",
      key: "length",
      type: "select",
      options: ["one-page", "two-page"],
      default: "one-page",
    },
    {
      name: "Decision Needed",
      key: "decision",
      type: "text",
      placeholder: "e.g., fund new initiative, approve budget",
    },
    {
      name: "Risk Level",
      key: "riskLevel",
      type: "select",
      options: ["low", "moderate", "high"],
      default: "moderate",
    },
  ],
  systemPrompt: `You are an expert briefing writer. Generate concise, executive-ready briefs.
Lead with the core point, provide context, outline options, and state risks.
Use bullet points for clarity. Assume time-constrained reader.`,
};
