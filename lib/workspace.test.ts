import { describe, expect, it } from "vitest";
import { getThreadPreview, parseWorkspaceThreads } from "./workspace";

describe("parseWorkspaceThreads", () => {
  it("accepts the current draft shape", () => {
    const threads = parseWorkspaceThreads([
      {
        id: "thread-1",
        title: "Thread 1",
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:00:00.000Z",
        currentStage: "day-a-feedback",
        entries: [],
        draft: {
          mode: "day-a",
          essay: "Hello",
          lastSavedAt: "2026-04-24T10:00:00.000Z"
        }
      }
    ]);

    expect(threads).toHaveLength(1);
    expect(threads[0]?.draft.essay).toBe("Hello");
  });

  it("migrates legacy draft payloads with removed fields", () => {
    const threads = parseWorkspaceThreads([
      {
        id: "thread-legacy",
        title: "Legacy",
        createdAt: "2026-04-23T10:00:00.000Z",
        updatedAt: "2026-04-23T10:00:00.000Z",
        currentStage: "day-a-feedback",
        entries: [],
        draft: {
          mode: "day-b",
          essay: "Legacy essay",
          phrasesInput: "due to, in advance",
          keywords: "hybrid work",
          lastSavedAt: "2026-04-23T10:00:00.000Z"
        }
      }
    ]);

    expect(threads).toHaveLength(1);
    expect(threads[0]?.draft).toEqual({
      mode: "day-b",
      essay: "Legacy essay",
      lastSavedAt: "2026-04-23T10:00:00.000Z"
    });
  });

  it("drops invalid stored thread payloads", () => {
    const threads = parseWorkspaceThreads([
      {
        id: "broken-thread",
        title: "Broken",
        createdAt: "not-a-date",
        updatedAt: "2026-04-24T10:00:00.000Z",
        currentStage: "draft-v1",
        entries: [],
        draft: {
          mode: "day-a",
          essay: "Hello",
          lastSavedAt: "2026-04-24T10:00:00.000Z"
        }
      }
    ]);

    expect(threads).toEqual([]);
  });
});

describe("getThreadPreview", () => {
  it("strips markdown markers from assistant feedback previews", () => {
    const preview = getThreadPreview({
      id: "thread-preview",
      title: "Preview",
      createdAt: "2026-04-24T10:00:00.000Z",
      updatedAt: "2026-04-24T10:00:00.000Z",
      currentStage: "day-a-feedback",
      entries: [
        {
          id: "entry-1",
          threadId: "thread-preview",
          kind: "assistant-feedback",
          label: "Day A Feedback",
          mode: "day-a",
          content: "## Drills\n- Rewrite this sentence naturally.\nAnswer: Use a smoother sentence.",
          createdAt: "2026-04-24T10:00:00.000Z"
        }
      ],
      draft: {
        mode: "day-b",
        essay: "",
        lastSavedAt: "2026-04-24T10:00:00.000Z"
      }
    });

    expect(preview).toBe("Drills Rewrite this sentence naturally. Answer: Use a smoother sentence.");
  });
});
