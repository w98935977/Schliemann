import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildUserPrompt,
  coachingInstructions,
  defaultGeminiModel,
  type TrainingMode
} from "@/lib/schliemann";
import { getGeminiClient } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mode: z.enum(["day-a", "day-b"]),
  essay: z.string().trim().min(1, "Essay is required."),
  phrases: z.array(z.string().trim()).default([]),
  keywords: z.string().trim().optional().default("")
});

function summarizeMode(mode: TrainingMode) {
  return mode === "day-a" ? "Day A" : "Day B";
}

function normalizeModelOutput(output: string) {
  return output
    .replace(/\r\n/g, "\n")
    .replace(/^Hello![\s\S]*?(?=^##\s)/m, "")
    .replace(/\\{6,}/g, "__________")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "GEMINI_API_KEY is missing. Add it to .env.local first."
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid request payload."
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const client = getGeminiClient();
    const prompt = buildUserPrompt(payload);
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || defaultGeminiModel,
      config: {
        systemInstruction: `${coachingInstructions}\n\nThe current request is ${summarizeMode(payload.mode)}. Stay inside that mode and use only the required section headings for that mode.`,
        temperature: 0.5
      },
      contents: prompt
    });
    const output = normalizeModelOutput(response.text?.trim() ?? "");

    if (!output) {
      return NextResponse.json(
        {
          ok: false,
          error: "Gemini returned an empty response. Please try again."
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      output
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error while contacting Gemini.";

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
