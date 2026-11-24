export type DocumentType = "email" | "proposal" | "report" | "brief" | "case-study";

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

export interface DocumentConfig {
  name: string;
  description: string;
  dials: DocumentDial[];
  systemPrompt: string;
}

export const documentTypes: Record<DocumentType, DocumentConfig> = {
  email: {
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
  },
  proposal: {
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
  },
  report: {
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
  },
  brief: {
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
  },
  "case-study": {
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
  },
};
