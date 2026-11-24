import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { documentTypes, DocumentType } from "@/lib/config";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GenerateRequest {
  documentType: DocumentType;
  dials: Record<string, string | number>;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { documentType, dials } = body;

    if (!documentType || !Object.keys(documentTypes).includes(documentType)) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    const config = documentTypes[documentType];
    const userPrompt = buildUserPrompt(config.name, dials);

    const response = await client.messages.create({
      model: "claude-opus-4-1",
      max_tokens: 4096,
      system: config.systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const generatedContent =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      success: true,
      content: generatedContent,
      metadata: {
        documentType,
        dials,
        model: "claude-opus-4-1",
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("Generation error:", error);

    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Authentication failed. Check ANTHROPIC_API_KEY." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}

function buildUserPrompt(
  documentType: string,
  dials: Record<string, string | number>
): string {
  const dialLines = Object.entries(dials)
    .filter(([_, value]) => value !== "")
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  return `Generate a ${documentType.toLowerCase()} with these specifications:\n\n${dialLines}`;
}
