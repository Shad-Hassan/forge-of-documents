import type { TemplateDef } from "../types";

export const report: TemplateDef = {
  id: "report",
  name: "Report",
  description: "Business or technical report",
  dials: [
    {
      name: "Report Type",
      key: "reportType",
      type: "select",
      options: ["quarterly", "technical", "incident", "market-analysis"],
      default: "quarterly",
    },
    {
      name: "Audience Level",
      key: "audience",
      type: "select",
      options: ["executive", "technical", "general"],
      default: "executive",
    },
    {
      name: "Key Metrics",
      key: "metrics",
      type: "text",
      placeholder: "e.g., growth rate, user retention",
    },
    {
      name: "Sections Needed",
      key: "sections",
      type: "text",
      placeholder: "e.g., summary, findings, recommendations",
    },
  ],
  systemPrompt: `You are an expert report writer. Generate structured, data-driven reports.
Use clear headings, concise paragraphs, and actionable insights.
Tailor depth and language to the specified audience level.`,
};
