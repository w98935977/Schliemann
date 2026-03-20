# Schliemann Writing Studio

Single-page Next.js MVP for your Schliemann English-writing workflow. The app lets you draft inside a thread-based workspace, choose `Day A` or `Day B`, submit to a server-side Gemini API route, and review saved snapshots in the browser.

## Features

- Left-side thread list so each writing cycle feels closer to a chat workspace
- Collapsible sidebar that starts closed, similar to GPT-style navigation
- Browser-local autosave for the active draft, phrases, and keywords in each thread
- Version timeline per thread so you can revisit saved student drafts and assistant feedback
- Delete-thread controls for removing browser-local conversation history
- `Day A` mode for Essay v1 -> `v2`, `Error Patterns`, `Sentence Bank`, `Drills`
- `Day B` mode for Rewrite v3 -> `Progress`, `Habits To Keep Fixing`, `More Natural Version`
- Server-side Gemini call so the API key never reaches the browser

## Current persistence model

- Draft typing still autosaves in `localStorage` on the same browser.
- Submitted thread snapshots can also be written to Postgres when `DATABASE_URL` is configured.
- On a shared deployment with the same database, submitted feedback history can be loaded on another device.
- For Vercel deployments, add `DATABASE_URL` in Project Settings → Environment Variables and redeploy; without that, the app stays in local-only mode.
- The current MVP does not include user accounts yet, so a production multi-user deployment still needs auth / workspace scoping.

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
- `DATABASE_URL`: optional Postgres connection string for shared submitted-thread persistence

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
- Postgres persistence now stores submitted thread snapshots, while in-progress draft typing still remains browser-local until you submit.
