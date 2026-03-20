"use client";

import { Fragment, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { modeCopy, normalizePhraseInput, type TrainingMode } from "@/lib/schliemann";
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

function renderAssistantOutput(output: string) {
  const normalized = output.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return null;
  }

  const lines = normalized.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line === "---") {
      blocks.push(<hr key={`hr-${index}`} />);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={`heading-${index}`} className="response-heading">
          {line.slice(3)}
        </h3>
      );
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${index}`} className="response-list response-list-numbered">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={`ul-${index}`} className="response-list">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
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

    blocks.push(
      <p key={`p-${index}`} className="response-paragraph">
        {renderInlineMarkdown(paragraphLines.join(" "))}
      </p>
    );
  }

  return blocks;
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
        <strong>{thread.title}</strong>
        <div className="thread-card-actions">
          <span>{formatTimestamp(thread.updatedAt)}</span>
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

function SelectedEntryPanel({ entry, onLoadDraft }: SelectedEntryPanelProps) {
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
        {entry?.kind === "student-draft" ? (
          <button className="ghost-button" type="button" onClick={() => onLoadDraft(entry)}>
            Load into editor
          </button>
        ) : null}
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

export default function HomePage() {
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [threads, setThreads] = useState<WorkspaceThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [mode, setMode] = useState<TrainingMode>("day-a");
  const [essay, setEssay] = useState("");
  const [phrasesInput, setPhrasesInput] = useState("");
  const [keywords, setKeywords] = useState("");
  const [apiState, setApiState] = useState<ApiState>(initialApiState);

  useEffect(() => {
    const storedThreads = parseStoredThreads();
    const nextThreads = storedThreads.length > 0 ? storedThreads : [createHiddenPlaceholderThread()];
    const initialThread = nextThreads[0];

    setThreads(nextThreads);
    setActiveThreadId(initialThread?.id ?? null);
    setSelectedEntryId(initialThread?.entries.at(-1)?.id ?? null);
    setMode(initialThread?.draft.mode ?? "day-a");
    setEssay(initialThread?.draft.essay ?? "");
    setPhrasesInput(initialThread?.draft.phrasesInput ?? "");
    setKeywords(initialThread?.draft.keywords ?? "");
    setWorkspaceReady(true);
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
            title: summarizeThreadTitle(nextDraft.essay ?? thread.draft.essay),
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
    setSelectedEntryId(thread.entries.at(-1)?.id ?? null);
    setMode(thread.draft.mode);
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
      `Delete "${thread.title}" and all saved snapshots in this browser?`
    );

    if (!shouldDelete) {
      return;
    }

    const remainingThreads = threads.filter((item) => item.id !== threadId);
    const fallbackThread = remainingThreads[0] ?? createHiddenPlaceholderThread();
    const nextThreads = remainingThreads.length > 0 ? sortThreads(remainingThreads) : [fallbackThread];

    setThreads(nextThreads);

    if (activeThreadId === threadId) {
      setActiveThreadId(fallbackThread.id);
      setSelectedEntryId(fallbackThread.entries.at(-1)?.id ?? null);
      setMode(fallbackThread.draft.mode);
      setEssay(fallbackThread.draft.essay);
      setPhrasesInput(fallbackThread.draft.phrasesInput);
      setKeywords(fallbackThread.draft.keywords);
      setApiState(initialApiState);
    }
  }

  function handleModeChange(nextMode: TrainingMode) {
    setMode(nextMode);
    syncDraftToThread({ mode: nextMode });
  }

  function handleLoadDraft(entry: WorkspaceEntry) {
    if (entry.kind !== "student-draft") {
      return;
    }

    setMode(entry.mode);
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

      setThreads((currentThreads) => {
        const existingThread = currentThreads.find((thread) => thread.id === threadId);
        const baseThread = existingThread ?? createEmptyThread();

        return sortThreads([
          {
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
              phrasesInput,
              keywords,
              lastSavedAt: now
            }
          },
          ...currentThreads.filter((thread) => thread.id !== threadId)
        ]);
      });

      setSelectedEntryId(assistantEntry.id);
      setActiveThreadId(threadId);
      setMode(mode === "day-a" ? "day-b" : mode);
      setEssay("");
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
    return (
      <div className="thread-toolbar">
        <div>
          <strong>{activeThread?.title ?? "Untitled draft"}</strong>
          <p>
            Autosaved in this browser. To sync across devices later, wire the same data model
            into Postgres.
          </p>
        </div>
        <span className="thread-toolbar-badge">{savedSnapshotCount}</span>
      </div>
    );
  }

  function renderEntryTabs() {
    if (!activeThread?.entries.length) {
      return null;
    }

    return (
      <div className="entry-tabs" role="tablist" aria-label="Thread snapshots">
        {activeThread.entries.map((entry) => (
          <EntryTabButton
            key={entry.id}
            entry={entry}
            isSelected={selectedEntryId === entry.id}
            onSelect={() => setSelectedEntryId(entry.id)}
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
            <p>Local browser history for your essay cycles.</p>
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
          Your draft history now stays in this browser. The left rail works like a lightweight
          writing thread list, while the main workspace keeps each thread&apos;s latest draft and
          feedback snapshots together.
        </p>
      </section>

      <section className="workspace workspace-layout" data-sidebar-open={isSidebarOpen}>
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

        <div className="workspace-main">
          <section className="panel form-panel">
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
                <p className="field-help">
                  Autosaves to this browser as you type. Submit still requires a non-empty essay.
                </p>
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

          <SelectedEntryPanel entry={selectedEntry} onLoadDraft={handleLoadDraft} />
        </div>
      </section>
    </main>
  );
}
