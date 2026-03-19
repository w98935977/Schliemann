import type { TrainingMode } from "@/lib/schliemann";

export type WorkspaceEntryKind = "student-draft" | "assistant-feedback";

export type WorkspaceEntry = {
  id: string;
  threadId: string;
  kind: WorkspaceEntryKind;
  label: string;
  mode: TrainingMode;
  content: string;
  createdAt: string;
};

export type ThreadDraft = {
  mode: TrainingMode;
  essay: string;
  phrasesInput: string;
  keywords: string;
  lastSavedAt: string;
};

export type WorkspaceThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentStage: string;
  isPlaceholder?: boolean;
  entries: WorkspaceEntry[];
  draft: ThreadDraft;
};

export const workspaceStorageKey = "schliemann.workspace.v1";

export function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function summarizeThreadTitle(essay: string) {
  const firstLine = essay
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "Untitled draft";
  }

  return firstLine.length > 48 ? `${firstLine.slice(0, 48).trimEnd()}…` : firstLine;
}

export function createEmptyThread(options?: { isPlaceholder?: boolean }): WorkspaceThread {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "Untitled draft",
    createdAt: now,
    updatedAt: now,
    currentStage: "draft-v1",
    isPlaceholder: options?.isPlaceholder ?? false,
    entries: [],
    draft: {
      mode: "day-a",
      essay: "",
      phrasesInput: "",
      keywords: "",
      lastSavedAt: now
    }
  };
}

export function getStudentEntryLabel(mode: TrainingMode, entries: WorkspaceEntry[]) {
  const hasDayAFeedback = entries.some(
    (entry) => entry.kind === "assistant-feedback" && entry.mode === "day-a"
  );

  if (mode === "day-a" && entries.length === 0) {
    return "v1";
  }

  if (mode === "day-b" && hasDayAFeedback) {
    return "v3";
  }

  const draftCount = entries.filter((entry) => entry.kind === "student-draft").length + 1;
  return `Draft ${draftCount}`;
}

export function getAssistantEntryLabel(mode: TrainingMode) {
  return mode === "day-a" ? "Day A Feedback" : "Day B Feedback";
}

export function getStageFromMode(mode: TrainingMode, kind: WorkspaceEntryKind) {
  if (mode === "day-a") {
    return kind === "assistant-feedback" ? "day-a-feedback" : "draft-v1";
  }

  return kind === "assistant-feedback" ? "day-b-feedback" : "rewrite-v3";
}

export function getThreadPreview(thread: WorkspaceThread) {
  const latestEntry = thread.entries[thread.entries.length - 1];
  const sourceText = latestEntry?.content || thread.draft.essay || "No writing yet.";
  const normalized = sourceText.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "No writing yet.";
  }

  return normalized.length > 88 ? `${normalized.slice(0, 88).trimEnd()}…` : normalized;
}

export function sortThreads(threads: WorkspaceThread[]) {
  return [...threads].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function formatTimestamp(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
