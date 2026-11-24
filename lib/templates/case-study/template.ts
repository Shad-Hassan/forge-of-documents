import type { TemplateDef } from "../types";

export const caseStudy: TemplateDef = {
  id: "case-study",
  name: "Case Study",
  description: "Client success or project case study",
  dials: [
    {
      name: "Client Industry",
      key: "industry",
      type: "text",
      placeholder: "e.g., SaaS, healthcare, fintech",
    },
    {
      name: "Challenge Type",
      key: "challenge",
      type: "select",
      options: ["efficiency", "scaling", "security", "user-experience"],
      default: "scaling",
    },
    {
      name: "Result Focus",
      key: "resultFocus",
      type: "text",
      placeholder: "e.g., 300% growth, 50% cost reduction",
    },
    {
      name: "Narrative Tone",
      key: "tone",
      type: "select",
      options: ["storytelling", "data-driven", "technical"],
      default: "storytelling",
    },
  ],
  systemPrompt: `You are an expert case study writer. Generate compelling, structured case studies.
Follow problem-solution-results format. Use specific metrics and examples.
Make it relatable and inspirational while maintaining credibility.`,
};
