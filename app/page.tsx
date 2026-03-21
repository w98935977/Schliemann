"use client";

import { Fragment, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { modeCopy, normalizePhraseInput, type TrainingMode } from "@/lib/schliemann";
import { loraFontBase64 } from "@/lib/pdf-fonts";
import {
  createEmptyThread,
  createId,
  formatTimestamp,
  getAssistantEntryLabel,
  getStageFromMode,
  getStudentEntryLabel,
  getThreadPreview,
  sortThreads,
  summarizeThreadTitle,
  workspaceStorageKey,
  type WorkspaceEntry,
  type WorkspaceThread
} from "@/lib/workspace";

type ApiState = {
  error: string;
  loading: boolean;
};

type WorkspaceSource = "database" | "local";

type AssistantBlock =
  | { type: "heading"; content: string }
  | { type: "ordered-list"; items: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "paragraph"; content: string }
  | { type: "divider" };

type ThreadCardProps = {
  isActive: boolean;
  isDeletable: boolean;
  onDelete: () => void;
  onSelect: () => void;
  thread: WorkspaceThread;
};

type EntryTabButtonProps = {
  entry: WorkspaceEntry;
  isSelected: boolean;
  onSelect: () => void;
};

type SelectedEntryPanelProps = {
  entry: WorkspaceEntry | null;
  onLoadDraft: (entry: WorkspaceEntry) => void;
  onExportPdf: (entry: WorkspaceEntry) => void;
};

const initialApiState: ApiState = {
  error: "",
  loading: false
};

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>;
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function stripInlineMarkdown(text: string) {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function parseAssistantOutput(output: string) {
  const normalized = output.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [] as AssistantBlock[];
  }

  const lines = normalized.split("\n");
  const blocks: AssistantBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line === "---") {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", content: line.slice(3) });
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push({ type: "ordered-list", items });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push({ type: "unordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const current = lines[index].trim();

      if (
        !current ||
        current === "---" ||
        current.startsWith("## ") ||
        /^\d+\.\s+/.test(current) ||
        /^[-*]\s+/.test(current)
      ) {
        break;
      }

      paragraphLines.push(current);
      index += 1;
    }

    blocks.push({ type: "paragraph", content: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderAssistantOutput(output: string) {
  const blocks = parseAssistantOutput(output);

  if (blocks.length === 0) {
    return null;
  }

  return blocks.map((block, index) => {
    if (block.type === "divider") {
      return <hr key={`hr-${index}`} />;
    }

    if (block.type === "heading") {
      return (
        <h3 key={`heading-${index}`} className="response-heading">
          {block.content}
        </h3>
      );
    }

    if (block.type === "ordered-list") {
      return (
        <ol key={`ol-${index}`} className="response-list response-list-numbered">
          {block.items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
    }

    if (block.type === "unordered-list") {
      return (
        <ul key={`ul-${index}`} className="response-list">
          {block.items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`p-${index}`} className="response-paragraph">
        {renderInlineMarkdown(block.content)}
      </p>
    );
  });
}

function getDisplayThreadTitle(thread: WorkspaceThread) {
  return thread.title === "Untitled draft" ? formatTimestamp(thread.createdAt) : thread.title;
}

function ThreadCardButton({ isActive, isDeletable, onDelete, onSelect, thread }: ThreadCardProps) {
  return (
    <div
      className="thread-card"
      data-active={isActive}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="thread-card-top">
        <strong>{getDisplayThreadTitle(thread)}</strong>
        <div className="thread-card-actions">
          {isDeletable ? (
            <button
              className="thread-delete-button"
              type="button"
              aria-label={`Delete ${thread.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <p>{getThreadPreview(thread)}</p>
      <span className="thread-stage">{thread.currentStage.replace(/-/g, " ")}</span>
    </div>
  );
}

function EntryTabButton({ entry, isSelected, onSelect }: EntryTabButtonProps) {
  return (
    <button type="button" className="entry-tab" aria-pressed={isSelected} onClick={onSelect}>
      <span>{entry.label}</span>
      <small>{entry.mode === "day-a" ? "Day A" : "Day B"}</small>
    </button>
  );
}

function SelectedEntryPanel({
  entry,
  onLoadDraft,
  onExportPdf
}: SelectedEntryPanelProps) {
  const heading = entry ? `${entry.label} · ${formatTimestamp(entry.createdAt)}` : "Assistant Response";
  const meta = entry
    ? entry.kind === "assistant-feedback"
      ? "Saved feedback snapshot from your workspace history."
      : "Saved student draft snapshot. Use Load into editor to continue revising from here."
    : "Your latest saved draft or assistant feedback will appear here.";

  return (
    <section className="panel result-card">
      <div className="result-card-header">
        <div>
          <h2>{heading}</h2>
          <p className="result-meta">{meta}</p>
        </div>
        <div className="result-card-actions">
          {entry?.kind === "assistant-feedback" ? (
              <button className="ghost-button" type="button" onClick={() => onExportPdf(entry)}>
                Export PDF
              </button>
          ) : null}
          {entry?.kind === "student-draft" ? (
            <button className="ghost-button" type="button" onClick={() => onLoadDraft(entry)}>
              Load into editor
            </button>
          ) : null}
        </div>
      </div>

      {entry ? (
        entry.kind === "assistant-feedback" ? (
          <div className="response-content">{renderAssistantOutput(entry.content)}</div>
        ) : (
          <div className="student-entry-card">
            <div className="student-entry-meta">
              <span className="thread-stage">
                {entry.mode === "day-a" ? "Day A draft" : "Day B rewrite"}
              </span>
              <span>{formatTimestamp(entry.createdAt)}</span>
            </div>
            <pre>{entry.content}</pre>
          </div>
        )
      ) : (
        <div className="empty-state">
          <div>
            <strong>No saved snapshot yet</strong>
            <p>
              Submit your current draft to save both the student version and the assistant
              response into this browser-side workspace history.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function parseStoredThreads() {
  if (typeof window === "undefined") {
    return [] as WorkspaceThread[];
  }

  const storedValue = window.localStorage.getItem(workspaceStorageKey);

  if (!storedValue) {
    return [] as WorkspaceThread[];
  }

  try {
    const parsed = JSON.parse(storedValue) as WorkspaceThread[];
    return Array.isArray(parsed) ? sortThreads(parsed) : [];
  } catch {
    return [] as WorkspaceThread[];
  }
}

function createHiddenPlaceholderThread() {
  return createEmptyThread({ isPlaceholder: true });
}

async function loadWorkspaceFromServer() {
  try {
    const response = await fetch("/api/workspace", {
      method: "GET",
      cache: "no-store"
    });

    const data = (await response.json()) as {
      ok: boolean;
      source?: "database" | "local";
      threads?: WorkspaceThread[];
      reason?: string;
    };

    if (!response.ok || !data.ok) {
      return null;
    }

    return {
      source: data.source ?? "local",
      threads: data.source === "database" ? sortThreads(data.threads ?? []) : [],
      reason: data.reason ?? ""
    };
  } catch {
    return {
      source: "local" as const,
      threads: [] as WorkspaceThread[],
      reason: "Unable to check the shared workspace service right now."
    };
  }
}

async function persistThreadToServer(thread: WorkspaceThread) {
  const response = await fetch("/api/workspace", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ thread })
  });

  const data = (await response.json()) as {
    ok: boolean;
    persisted?: boolean;
    error?: string;
    reason?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Unable to save this thread to the shared workspace.");
  }

  return {
    persisted: data.persisted ?? false,
    reason: data.reason ?? ""
  };
}

async function deleteThreadFromServer(threadId: string) {
  const response = await fetch(`/api/workspace?threadId=${encodeURIComponent(threadId)}`, {
    method: "DELETE"
  });

  const data = (await response.json()) as {
    ok: boolean;
    deleted?: boolean;
    error?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Unable to delete this thread from the shared workspace.");
  }

  return data.deleted ?? false;
}

function registerPdfFont(
  document: {
    addFileToVFS: (fileName: string, fileData: string) => void;
    addFont: (postScriptName: string, family: string, style: "normal" | "bold") => void;
  },
  fileName: string,
  family: string,
  style: "normal" | "bold"
) {
  document.addFileToVFS(fileName, loraFontBase64);
  document.addFont(fileName, family, style);
}

function formatPdfFilename(entry: WorkspaceEntry) {
  const baseName = entry.label.replace(/\s+/g, "-");
  const dateSegment = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  })
    .format(new Date(entry.createdAt))
    .replace(/\s+/g, "-");

  return `${baseName}-${dateSegment}`;
}

function getPreferredEntryId(entries: WorkspaceEntry[], mode: TrainingMode) {
  const latestDraft = [...entries].reverse().find(
    (entry) => entry.mode === mode && entry.kind === "student-draft"
  );

  if (latestDraft) {
    return latestDraft.id;
  }

  return [...entries].reverse().find((entry) => entry.mode === mode)?.id ?? null;
}

export default function HomePage() {
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [workspaceSource, setWorkspaceSource] = useState<WorkspaceSource>("local");
  const [workspaceStatusMessage, setWorkspaceStatusMessage] = useState("");
  const [threads, setThreads] = useState<WorkspaceThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [mode, setMode] = useState<TrainingMode>("day-a");
  const [isEditorVisible, setIsEditorVisible] = useState(true);
  const [essay, setEssay] = useState("");
  const [phrasesInput, setPhrasesInput] = useState("");
  const [keywords, setKeywords] = useState("");
  const [apiState, setApiState] = useState<ApiState>(initialApiState);

  useEffect(() => {
    let isCancelled = false;

    async function initializeWorkspace() {
      const syncedWorkspace = await loadWorkspaceFromServer();
      const storedThreads = parseStoredThreads();
      const nextThreads =
        syncedWorkspace && syncedWorkspace.threads.length > 0
          ? syncedWorkspace.threads
          : storedThreads.length > 0
            ? storedThreads
            : [createHiddenPlaceholderThread()];
      const initialThread = nextThreads[0];

      if (isCancelled) {
        return;
      }

      setWorkspaceSource(syncedWorkspace?.source ?? "local");
      setWorkspaceStatusMessage(syncedWorkspace?.reason ?? "");
      setThreads(nextThreads);
      setActiveThreadId(initialThread?.id ?? null);
      setSelectedEntryId(getPreferredEntryId(initialThread?.entries ?? [], initialThread?.draft.mode ?? "day-a"));
      setMode(initialThread?.draft.mode ?? "day-a");
      setIsEditorVisible(true);
      setEssay(initialThread?.draft.essay ?? "");
      setPhrasesInput(initialThread?.draft.phrasesInput ?? "");
      setKeywords(initialThread?.draft.keywords ?? "");
      setWorkspaceReady(true);
    }

    void initializeWorkspace();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceReady) {
      return;
    }

    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(sortThreads(threads)));
  }, [threads, workspaceReady]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );
  const visibleThreads = useMemo(() => threads.filter((thread) => !thread.isPlaceholder), [threads]);
  const selectedEntry = useMemo(
    () => activeThread?.entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [activeThread, selectedEntryId]
  );
  const modeEntries = useMemo(
    () => activeThread?.entries.filter((entry) => entry.mode === mode) ?? [],
    [activeThread, mode]
  );

  useEffect(() => {
    if (!activeThread) {
      return;
    }

    const matchingEntries = activeThread.entries.filter((entry) => entry.mode === mode);

    if (matchingEntries.length === 0) {
      setSelectedEntryId(null);
      setIsEditorVisible(true);
      return;
    }

    if (!matchingEntries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(getPreferredEntryId(matchingEntries, mode));
    }
  }, [activeThread, mode, selectedEntryId]);

  const copy = modeCopy[mode];
  const phrases = useMemo(() => normalizePhraseInput(phrasesInput), [phrasesInput]);
  const savedSnapshotCount = activeThread
    ? `${activeThread.entries.length} saved snapshots`
    : "0 saved snapshots";

  function syncDraftToThread(nextDraft: Partial<WorkspaceThread["draft"]> & { mode?: TrainingMode }) {
    if (!activeThreadId) {
      return;
    }

    setThreads((currentThreads) =>
      sortThreads(
        currentThreads.map((thread) => {
          if (thread.id !== activeThreadId) {
            return thread;
          }

          return {
            ...thread,
            isPlaceholder: false,
            title: summarizeThreadTitle(nextDraft.essay ?? thread.draft.essay, thread.createdAt),
            updatedAt: new Date().toISOString(),
            draft: {
              ...thread.draft,
              ...nextDraft,
              lastSavedAt: new Date().toISOString()
            }
          };
        })
      )
    );
  }

  function handleSelectThread(threadId: string) {
    const thread = threads.find((item) => item.id === threadId);

    if (!thread) {
      return;
    }

    setActiveThreadId(thread.id);
    setSelectedEntryId(getPreferredEntryId(thread.entries, thread.draft.mode));
    setMode(thread.draft.mode);
    setIsEditorVisible(true);
    setEssay(thread.draft.essay);
    setPhrasesInput(thread.draft.phrasesInput);
    setKeywords(thread.draft.keywords);
    setApiState(initialApiState);
  }

  function handleCreateThread() {
    const nextThread = createEmptyThread();

    setThreads((currentThreads) => sortThreads([nextThread, ...currentThreads]));
    setActiveThreadId(nextThread.id);
    setSelectedEntryId(null);
    setIsSidebarOpen(true);
    setMode(nextThread.draft.mode);
    setIsEditorVisible(true);
    setEssay("");
    setPhrasesInput("");
    setKeywords("");
    setApiState(initialApiState);
  }

  function handleDeleteThread(threadId: string) {
    const thread = threads.find((item) => item.id === threadId);

    if (!thread) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete "${getDisplayThreadTitle(thread)}" and all saved snapshots in this browser?`
    );

    if (!shouldDelete) {
      return;
    }

    const remainingThreads = threads.filter((item) => item.id !== threadId);
    const fallbackThread = remainingThreads[0] ?? createHiddenPlaceholderThread();
    const nextThreads = remainingThreads.length > 0 ? sortThreads(remainingThreads) : [fallbackThread];

      setThreads(nextThreads);
      setWorkspaceSource("local");
      setWorkspaceStatusMessage("This thread was removed locally. Shared sync will update only when the deployment has a working DATABASE_URL.");

      if (activeThreadId === threadId) {
      setActiveThreadId(fallbackThread.id);
      setSelectedEntryId(getPreferredEntryId(fallbackThread.entries, fallbackThread.draft.mode));
      setMode(fallbackThread.draft.mode);
      setIsEditorVisible(true);
      setEssay(fallbackThread.draft.essay);
      setPhrasesInput(fallbackThread.draft.phrasesInput);
      setKeywords(fallbackThread.draft.keywords);
      setApiState(initialApiState);
    }

    void deleteThreadFromServer(threadId).catch((error) => {
      setApiState({
        loading: false,
        error: error instanceof Error ? error.message : "Deleted locally but failed to sync delete."
      });
    });
  }

  function handleModeChange(nextMode: TrainingMode) {
    setMode(nextMode);
    setIsEditorVisible(true);
    syncDraftToThread({ mode: nextMode });
  }

  function handleLoadDraft(entry: WorkspaceEntry) {
    if (entry.kind !== "student-draft") {
      return;
    }

    setMode(entry.mode);
    setIsEditorVisible(true);
    setEssay(entry.content);
    setSelectedEntryId(entry.id);
    syncDraftToThread({
      essay: entry.content,
      mode: entry.mode
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEssay = essay.trim();

    if (!trimmedEssay) {
      setApiState({
        loading: false,
        error: "Please paste your essay before submitting."
      });
      return;
    }

    const threadId = activeThread?.id ?? createEmptyThread().id;

    if (!activeThread) {
      const nextThread = createEmptyThread();
      nextThread.id = threadId;
      nextThread.isPlaceholder = false;
      nextThread.title = summarizeThreadTitle(trimmedEssay);
      nextThread.draft = {
        mode,
        essay,
        phrasesInput,
        keywords,
        lastSavedAt: new Date().toISOString()
      };
      setThreads((currentThreads) => sortThreads([nextThread, ...currentThreads]));
      setActiveThreadId(threadId);
    }

    setApiState({
      loading: true,
      error: ""
    });

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode,
          essay: trimmedEssay,
          phrases,
          keywords
        })
      });

      const data = (await response.json()) as {
        ok: boolean;
        output?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "The review request failed.");
      }

      const now = new Date().toISOString();
      const userEntry: WorkspaceEntry = {
        id: createId(),
        threadId,
        kind: "student-draft",
        label: getStudentEntryLabel(mode, activeThread?.entries ?? []),
        mode,
        content: trimmedEssay,
        createdAt: now
      };
      const assistantEntry: WorkspaceEntry = {
        id: createId(),
        threadId,
        kind: "assistant-feedback",
        label: getAssistantEntryLabel(mode),
        mode,
        content: data.output || "",
        createdAt: now
      };

      const existingThread = threads.find((thread) => thread.id === threadId);
      const baseThread = existingThread ?? createEmptyThread();
      const nextThread: WorkspaceThread = {
        ...baseThread,
        id: threadId,
        isPlaceholder: false,
        title: summarizeThreadTitle(trimmedEssay),
        updatedAt: now,
        currentStage: getStageFromMode(mode, "assistant-feedback"),
        entries: [...baseThread.entries, userEntry, assistantEntry],
        draft: {
          mode: mode === "day-a" ? "day-b" : mode,
          essay: "",
          phrasesInput: "",
          keywords: "",
          lastSavedAt: now
        }
      };

      setThreads((currentThreads) => {
        return sortThreads([
          nextThread,
          ...currentThreads.filter((thread) => thread.id !== threadId)
        ]);
      });

      const persistenceResult = await persistThreadToServer(nextThread);
      setWorkspaceSource(persistenceResult.persisted ? "database" : "local");
      setWorkspaceStatusMessage(persistenceResult.reason);

      setSelectedEntryId(userEntry.id);
      setActiveThreadId(threadId);
      setMode(mode);
      setIsEditorVisible(true);
      setEssay("");
      setPhrasesInput("");
      setKeywords("");
      setApiState({
        loading: false,
        error: ""
      });
    } catch (error) {
      setApiState({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while submitting your writing."
      });
    }
  }

  function renderThreadToolbar() {
    const syncCopy =
      workspaceSource === "database"
        ? "Shared database sync is on. Submitted snapshots should be visible on another device connected to the same deployed app and database."
        : workspaceStatusMessage ||
          "You are in local-only mode right now. On Vercel, add DATABASE_URL in Project Settings → Environment Variables and redeploy to enable cross-device submitted-history sync.";

    return (
      <div className="thread-toolbar">
        <div>
          <strong>
            {activeThread ? getDisplayThreadTitle(activeThread) : formatTimestamp(new Date().toISOString())}
          </strong>
          <p>Review each Schliemann cycle by switching between Day A and Day B snapshots.</p>
        </div>
      </div>
    );
  }

  async function handleExportPdf(entry: WorkspaceEntry) {
    if (entry.kind !== "assistant-feedback") {
      return;
    }

    try {
      const { jsPDF } = await import("jspdf");
      const document = new jsPDF({
        unit: "pt",
        format: "a4"
      });
      registerPdfFont(document, "Lora-Regular.ttf", "Lora", "normal");
      registerPdfFont(document, "Lora-Bold.ttf", "Lora", "bold");

      const blocks = parseAssistantOutput(entry.content);
      const pageWidth = document.internal.pageSize.getWidth();
      const pageHeight = document.internal.pageSize.getHeight();
      const margin = 40;
      const maxWidth = pageWidth - margin * 2;
      const title = `${entry.label} · ${formatTimestamp(entry.createdAt)}`;
      let cursorY = margin;
      const lineHeight = 18;

      const ensurePageSpace = (requiredHeight: number) => {
        if (cursorY + requiredHeight <= pageHeight - margin) {
          return;
        }

        document.addPage();
        cursorY = margin;
      };

      document.setFont("Lora", "bold");
      document.setTextColor(31, 28, 24);
      document.setFontSize(20);
      document.text(title, margin, cursorY);
      cursorY += 16;

      document.setDrawColor(206, 185, 157);
      document.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 24;

      for (const block of blocks) {
        if (block.type === "divider") {
          ensurePageSpace(20);
          document.setDrawColor(222, 210, 190);
          document.line(margin, cursorY, pageWidth - margin, cursorY);
          cursorY += 20;
          continue;
        }

        if (block.type === "heading") {
          ensurePageSpace(24);
          document.setFont("Lora", "bold");
          document.setTextColor(127, 57, 23);
          document.setFontSize(14);
          document.text(stripInlineMarkdown(block.content), margin, cursorY);
          cursorY += 22;
          continue;
        }

        if (block.type === "paragraph") {
          const lines = document.splitTextToSize(stripInlineMarkdown(block.content), maxWidth);
          ensurePageSpace(lines.length * lineHeight + 12);
          document.setFont("Lora", "normal");
          document.setTextColor(31, 28, 24);
          document.setFontSize(12);

          for (const line of lines) {
            document.text(line, margin, cursorY);
            cursorY += lineHeight;
          }

          cursorY += 10;
          continue;
        }

        const bulletWidth = maxWidth - 18;
        const items = block.items.map((item, itemIndex) =>
          block.type === "ordered-list"
            ? `${itemIndex + 1}. ${stripInlineMarkdown(item)}`
            : `• ${stripInlineMarkdown(item)}`
        );

        document.setFont("Lora", "normal");
        document.setTextColor(31, 28, 24);
        document.setFontSize(12);

        for (const item of items) {
          const lines = document.splitTextToSize(item, bulletWidth);
          ensurePageSpace(lines.length * lineHeight + 8);

          for (const [lineIndex, line] of lines.entries()) {
            document.text(line, margin + (lineIndex === 0 ? 0 : 12), cursorY);
            cursorY += lineHeight;
          }

          cursorY += 4;
        }

        cursorY += 6;
      }

      document.save(`${formatPdfFilename(entry)}.pdf`);
    } catch (error) {
      setApiState({
        loading: false,
        error:
          error instanceof Error ? error.message : "Unable to export this feedback as a PDF right now."
      });
    }
  }

  function renderEntryTabs() {
    if (!modeEntries.length) {
      return null;
    }

    return (
      <div className="entry-tabs" role="tablist" aria-label="Thread snapshots">
        {modeEntries.map((entry) => (
          <EntryTabButton
            key={entry.id}
            entry={entry}
            isSelected={selectedEntryId === entry.id}
            onSelect={() => {
              if (entry.kind === "student-draft") {
                handleLoadDraft(entry);
                return;
              }

              setSelectedEntryId(entry.id);
            }}
          />
        ))}
      </div>
    );
  }

  function renderSidebar() {
    return (
      <aside id="thread-sidebar" className="panel sidebar-panel" data-open={isSidebarOpen}>
        <div className="sidebar-header">
          <div>
            <h2>Writing threads</h2>
            <p>Track each Schliemann cycle from v1 draft to feedback and revision.</p>
          </div>
          <div className="sidebar-actions">
            <button className="ghost-button" type="button" onClick={handleCreateThread}>
              New thread
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Collapse thread sidebar"
              onClick={() => setIsSidebarOpen(false)}
            >
              ←
            </button>
          </div>
        </div>

        <div className="sidebar-list" role="list">
          {visibleThreads.length > 0 ? (
            visibleThreads.map((thread) => (
              <ThreadCardButton
                key={thread.id}
                isActive={thread.id === activeThreadId}
                isDeletable={!thread.isPlaceholder}
                onDelete={() => handleDeleteThread(thread.id)}
                onSelect={() => handleSelectThread(thread.id)}
                thread={thread}
              />
            ))
          ) : (
            <div className="empty-thread-list">
              <strong>No saved threads yet</strong>
              <p>Your current draft stays in the editor until you submit it or create a new thread.</p>
            </div>
          )}
        </div>
      </aside>
    );
  }

  return (
    <main className="page-shell page-shell-wide">
      <section className="hero hero-wide">
        <span className="eyebrow">Schliemann Cycle</span>
        <h1>Train your English writing inside one focused workspace.</h1>
        <p>
          The Schliemann method turns one topic into a short learning cycle: write a Day A draft,
          study targeted feedback, then return on Day B to rewrite with stronger phrasing and
          clearer structure.
        </p>
      </section>

      <section className="workspace workspace-layout" data-sidebar-open={isSidebarOpen}>
        <div className="workspace-sidebar-rail" data-open={isSidebarOpen}>
          <button
            className="sidebar-toggle"
            type="button"
            data-open={isSidebarOpen}
            aria-expanded={isSidebarOpen}
            aria-controls="thread-sidebar"
            aria-label={isSidebarOpen ? "Hide thread sidebar" : "Show thread sidebar"}
            onClick={() => setIsSidebarOpen((currentValue) => !currentValue)}
          >
            <span aria-hidden="true">{isSidebarOpen ? "←" : "☰"}</span>
            <span>{isSidebarOpen ? "Hide threads" : "Show threads"}</span>
          </button>

          {renderSidebar()}
        </div>

        <div className="workspace-main">
          <section className="panel form-panel" data-hidden={!isEditorVisible}>
            <div className="panel-header panel-header-stacked">
              <div className="panel-header-copy">
                <h2>{copy.title}</h2>
                <p>{copy.subtitle}</p>
              </div>

              <div className="mode-tabs" role="tablist" aria-label="Training mode">
                <button
                  type="button"
                  className="mode-tab"
                  aria-pressed={mode === "day-a"}
                  onClick={() => handleModeChange("day-a")}
                >
                  <span>Day A</span>
                </button>
                <button
                  type="button"
                  className="mode-tab"
                  aria-pressed={mode === "day-b"}
                  onClick={() => handleModeChange("day-b")}
                >
                  <span>Day B</span>
                </button>
              </div>
            </div>

            {renderThreadToolbar()}
            {renderEntryTabs()}

            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="essay">{copy.essayLabel}</label>
                <textarea
                  id="essay"
                  name="essay"
                  placeholder={copy.essayPlaceholder}
                  value={essay}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setEssay(nextValue);
                    syncDraftToThread({ essay: nextValue });
                  }}
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="phrases">Phrases / collocations</label>
                  <textarea
                    id="phrases"
                    name="phrases"
                    placeholder="due to, in advance, take responsibility for"
                    value={phrasesInput}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setPhrasesInput(nextValue);
                      syncDraftToThread({ phrasesInput: nextValue });
                    }}
                  />
                  <p className="field-help">
                    {copy.phrasesHelp} Current count: <strong>{phrases.length}</strong>
                  </p>
                </div>

                <div className="field">
                  <label htmlFor="keywords">Keywords / topic</label>
                  <textarea
                    id="keywords"
                    name="keywords"
                    placeholder="Optional notes, focus areas, or topic hints"
                    value={keywords}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setKeywords(nextValue);
                      syncDraftToThread({ keywords: nextValue });
                    }}
                  />
                  <p className="field-help">{copy.keywordsHelp}</p>
                </div>
              </div>

              {apiState.error ? <div className="message error">{apiState.error}</div> : null}

              {!apiState.error && !apiState.loading && selectedEntry?.kind === "assistant-feedback" ? (
                <div className="message success">
                  Latest assistant feedback is saved in this browser. Pick any thread on the left to
                  revisit older cycles.
                </div>
              ) : null}

              <div className="actions">
                <button className="submit-button" type="submit" disabled={apiState.loading || !workspaceReady}>
                  {apiState.loading ? "Submitting..." : "Submit to Schliemann"}
                </button>
              </div>
            </form>
          </section>

          <SelectedEntryPanel
            entry={selectedEntry}
            onLoadDraft={handleLoadDraft}
            onExportPdf={handleExportPdf}
          />
        </div>
      </section>
    </main>
  );
}
