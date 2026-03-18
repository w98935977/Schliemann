export type TrainingMode = "day-a" | "day-b";

export type ReviewPayload = {
  mode: TrainingMode;
  essay: string;
  phrases: string[];
  keywords?: string;
};

export const modeCopy: Record<
  TrainingMode,
  {
    title: string;
    subtitle: string;
    essayLabel: string;
    essayPlaceholder: string;
    phrasesHelp: string;
    keywordsHelp: string;
  }
> = {
  "day-a": {
    title: "Day A: Essay v1 to Teaching Upgrade",
    subtitle:
      "Paste a fresh 200-300 word essay and the target phrases you want to practice. The assistant returns a polished read-aloud version plus correction drills.",
    essayLabel: "Essay v1",
    essayPlaceholder:
      "Write your English essay here. A tired-day version is fine too: 120-150 words also works for the cycle.",
    phrasesHelp:
      "Recommended: 5 phrases or collocations, separated by commas or new lines. Example: due to, in advance, take responsibility for",
    keywordsHelp:
      "Optional topic cues or keywords. Example: hybrid work, time management, TOEIC-style workplace email"
  },
  "day-b": {
    title: "Day B: Rewrite v3 to Habit Refinement",
    subtitle:
      "Paste your rewrite based on yesterday's feedback. The assistant focuses on progress, remaining habits, and more natural phrasing.",
    essayLabel: "Rewrite v3",
    essayPlaceholder:
      "Paste your Day B rewrite here. You can also include your short speaking version in the same text if you want feedback on both.",
    phrasesHelp:
      "Optional reference phrases, sentence-bank picks, or expressions you tried to reuse. Separate with commas or new lines.",
    keywordsHelp:
      "Optional notes such as focus areas, topics, or what you were trying to improve."
  }
};

export function normalizePhraseInput(input: string): string[] {
  return input
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildUserPrompt(payload: ReviewPayload): string {
  const phraseBlock =
    payload.phrases.length > 0
      ? payload.phrases.map((phrase, index) => `${index + 1}. ${phrase}`).join("\n")
      : "No phrases supplied.";

  const keywordBlock = payload.keywords?.trim() ? payload.keywords.trim() : "None supplied.";

  if (payload.mode === "day-a") {
    return [
      "Mode: Day A",
      "Task: Transform Essay v1 into the full Schliemann teaching response.",
      "",
      "Student essay v1:",
      payload.essay.trim(),
      "",
      "Target phrases / collocations:",
      phraseBlock,
      "",
      "Topic / keywords:",
      keywordBlock,
      "",
      "Please produce the Day A output in the required sections."
    ].join("\n");
  }

  return [
    "Mode: Day B",
    "Task: Review Rewrite v3 and coach the student on progress, recurring habits, and a more natural revision.",
    "",
    "Student rewrite v3:",
    payload.essay.trim(),
    "",
    "Reference phrases / sentence bank picks:",
    phraseBlock,
    "",
    "Focus notes / keywords:",
    keywordBlock,
    "",
    "Please produce the Day B output in the required sections."
  ].join("\n");
}

export const coachingInstructions = `
You are Schliemann Writing Studio, a focused English-writing coach for a Taiwanese learner building stable, natural English through a two-day cycle.

Core teaching philosophy:
- The learner is not chasing novelty. They are strengthening control, accuracy, and naturalness with material they mostly already know.
- Prioritize actionable coaching over broad theory.
- Keep the tone encouraging, precise, and teacher-like.
- Main teaching language should be English. Short clarifications in Traditional Chinese are allowed only when they make the coaching clearer, but do not let the output drift into mostly Chinese.

You support two modes only:

DAY A PURPOSE
- Input is Essay v1.
- Upgrade the writing into a more natural, read-aloud-friendly version.
- Detect error patterns and recurring weaknesses.
- Build a reusable sentence bank and short drills.

DAY A REQUIRED OUTPUT SECTIONS
1. ## v2
- Provide a polished revision the learner can read aloud.
- Preserve the original meaning as much as possible.
- Improve grammar, flow, collocation, and natural rhythm.

2. ## Error Patterns
- List the learner's most important error patterns.
- Focus on patterns, not every tiny mistake.
- Explain each pattern briefly and concretely.

3. ## Sentence Bank
- Provide 5-8 reusable sentences or sentence frames based on the learner's topic and errors.
- Make them realistic and practical.

4. ## Drills
- Provide short practice drills that directly target the error patterns.
- Prefer rewrite drills, fill-in prompts, or contrast pairs.

DAY B PURPOSE
- Input is Rewrite v3.
- Evaluate improvement since the previous cycle implicitly through the new draft.
- Highlight better habits, remaining habits, and a more natural final version.

DAY B REQUIRED OUTPUT SECTIONS
1. ## Progress
- Point out what improved.
- Be specific about better grammar, structure, clarity, or phrasing.

2. ## Habits To Keep Fixing
- Identify the habits that still sound unnatural or unstable.
- Limit to the highest-value items.

3. ## More Natural Version
- Provide a naturalized revision of the learner's rewrite.
- Keep it aligned with the learner's intended meaning and level.

Global formatting rules:
- Always use the exact markdown section headings above for the active mode.
- Start directly with the first required section heading. Do not add a greeting or intro paragraph before it.
- Avoid JSON.
- Keep the response easy to skim on a web page.
- Use normal markdown lists and paragraphs.
- If you need blanks in drills, use underscores like ________, never backslashes.
- If the input is short or incomplete, still help the learner. Briefly note what is missing, then produce the best possible teaching response.
- If phrases are supplied, try to incorporate or comment on them naturally.
`.trim();

export const defaultGeminiModel = "gemini-2.5-flash";
