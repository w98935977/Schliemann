# Schliemann Writing Studio

Single-page Next.js MVP for your Schliemann English-writing workflow. The app lets you paste an essay or rewrite, choose `Day A` or `Day B`, submit it to a server-side Gemini API route, and read the coaching response in the browser.

## Features

- `Day A` mode for Essay v1 -> `v2`, `Error Patterns`, `Sentence Bank`, `Drills`
- `Day B` mode for Rewrite v3 -> `Progress`, `Habits To Keep Fixing`, `More Natural Version`
- Server-side Gemini call so the API key never reaches the browser
- Single-page UI with mode switch, writing area, phrase input, keyword field, and result panel

## Local setup

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Copy environment variables:

```powershell
Copy-Item .env.example .env.local
```

4. Create a Gemini API key in Google AI Studio and put it into `.env.local`.
5. Start the dev server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

- `GEMINI_API_KEY`: required for all server-side Gemini requests
- `GEMINI_MODEL`: optional, defaults to `gemini-2.5-flash`

## API contract

`POST /api/review`

```json
{
  "mode": "day-a",
  "essay": "Your writing here",
  "phrases": ["due to", "in advance"],
  "keywords": "hybrid work"
}
```

Successful response:

```json
{
  "ok": true,
  "output": "## v2\n..."
}
```

Failure response:

```json
{
  "ok": false,
  "error": "Human-readable message"
}
```

## Notes

- This repo uses Google's official `@google/genai` SDK with a single `generateContent` request per submission.
- `gemini-2.5-flash` is the default model because it is fast and has a documented free tier on Google's pricing page.
