import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildUserPrompt,
  coachingInstructions,
  defaultGeminiModel,
  type TrainingMode
} from "@/lib/schliemann";
import {
  formatGeminiErrorMessage,
  getConfiguredGeminiModels,
  getGeminiClient,
  isGeminiRateLimitError,
  isGeminiRetryableError
} from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mode: z.enum(["day-a", "day-b"]),
  essay: z.string().trim().min(1, "Essay is required.")
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
    const modelsToTry = getConfiguredGeminiModels();
    let output = "";
    let usedModel = "";
    let lastError: unknown = null;

    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model,
          config: {
            systemInstruction: `${coachingInstructions}\n\nThe current request is ${summarizeMode(payload.mode)}. Stay inside that mode and use only the required section headings for that mode.`,
            temperature: 0.5
          },
          contents: prompt
        });

        output = normalizeModelOutput(response.text?.trim() ?? "");
        usedModel = model;

        if (!output) {
          throw new Error(`Gemini model "${model}" returned an empty response.`);
        }

        break;
      } catch (error) {
        lastError = error;

        if (!isGeminiRetryableError(error)) {
          break;
        }
      }
    }

    if (!output) {
      if (isGeminiRateLimitError(lastError)) {
        const attemptedModels = modelsToTry.join(", ");

        return NextResponse.json(
          {
            ok: false,
            error: `Google API quota was exhausted for the configured models (${attemptedModels}). Add more capacity or set GEMINI_FALLBACK_MODELS to other Gemini models with separate quota headroom.`
          },
          { status: 429 }
        );
      }

      if (isGeminiRetryableError(lastError)) {
        const attemptedModels = modelsToTry.join(", ");

        return NextResponse.json(
          {
            ok: false,
            error: `Google API is temporarily unavailable or under high demand for the configured models (${attemptedModels}). The server already tried the fallback chain. Wait a bit before retrying so you do not burn through RPD on repeated submits.`
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: lastError
            ? formatGeminiErrorMessage(lastError)
            : "Gemini returned an empty response. Please try again."
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      output,
      model: usedModel || process.env.GEMINI_MODEL || defaultGeminiModel
    });
  } catch (error) {
    const message = formatGeminiErrorMessage(error);

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
