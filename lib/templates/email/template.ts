import type { TemplateDef } from "../types";

export const email: TemplateDef = {
  id: "email",
  name: "Email",
  description: "Professional email message",
  dials: [
    {
      name: "Tone",
      key: "tone",
      type: "select",
      options: ["formal", "casual", "friendly", "urgent"],
      default: "formal",
    },
    {
      name: "Length",
      key: "length",
      type: "select",
      options: ["short", "medium", "long"],
      default: "medium",
    },
    {
      name: "Subject Line",
      key: "subject",
      type: "text",
      placeholder: "e.g., Project Update - Q4 Review",
    },
    {
      name: "Key Points",
      key: "keyPoints",
      type: "text",
      placeholder: "e.g., deadline, budget, stakeholders",
    },
  ],
  systemPrompt: `You are an expert email writer. Generate professional, clear, and concise emails.
Follow the tone and length specified. Structure with greeting, context, action items, and closing.
Return only the email body, no subject line prefix.`,
};
