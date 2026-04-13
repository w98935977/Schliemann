import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

const RETRYABLE_PATTERNS = [
  "429",
  "503",
  "rate limit",
  "resource_exhausted",
  "quota",
  "too many requests",
  "unavailable",
  "high demand",
  "try again later"
];

export function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
  }

  return client;
}

export function getConfiguredGeminiModels() {
  const preferredModels = [
    process.env.GEMINI_MODEL,
    process.env.GEMINI_FALLBACK_MODELS
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(preferredModels.length > 0 ? preferredModels : ["gemini-2.5-flash"])];
}

function getGeminiErrorMetadata(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      numericStatus: NaN,
      message: ""
    };
  }

  const candidate = error as {
    status?: number | string;
    code?: number | string;
    message?: string;
  };
  return {
    numericStatus: Number(candidate.status ?? candidate.code),
    message: candidate.message?.toLowerCase() ?? ""
  };
}

export function isGeminiRateLimitError(error: unknown) {
  const { numericStatus, message } = getGeminiErrorMetadata(error);

  return numericStatus === 429 || message.includes("resource_exhausted");
}

export function isGeminiRetryableError(error: unknown) {
  const { numericStatus, message } = getGeminiErrorMetadata(error);

  return (
    numericStatus === 429 ||
    numericStatus === 503 ||
    RETRYABLE_PATTERNS.some((pattern) => message.includes(pattern))
  );
}

export function formatGeminiErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unexpected server error while contacting Gemini.";
}
