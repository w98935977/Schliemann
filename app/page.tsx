"use client";

import { Fragment, FormEvent, ReactNode, useMemo, useState } from "react";
import { modeCopy, normalizePhraseInput, type TrainingMode } from "@/lib/schliemann";

type ApiState = {
  error: string;
  output: string;
  loading: boolean;
};

const initialApiState: ApiState = {
  error: "",
  output: "",
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

export default function HomePage() {
  const [mode, setMode] = useState<TrainingMode>("day-a");
  const [essay, setEssay] = useState("");
  const [phrasesInput, setPhrasesInput] = useState("");
  const [keywords, setKeywords] = useState("");
  const [apiState, setApiState] = useState<ApiState>(initialApiState);

  const copy = modeCopy[mode];
  const phrases = useMemo(() => normalizePhraseInput(phrasesInput), [phrasesInput]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEssay = essay.trim();

    if (!trimmedEssay) {
      setApiState({
        loading: false,
        output: "",
        error: "Please paste your essay before submitting."
      });
      return;
    }

    setApiState({
      loading: true,
      output: "",
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

      setApiState({
        loading: false,
        output: data.output || "",
        error: ""
      });
    } catch (error) {
      setApiState({
        loading: false,
        output: "",
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while submitting your writing."
      });
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">Schliemann Cycle</span>
        <h1>Train your English writing inside one focused workspace.</h1>
        <p>
          Draft on the left, get your guided revision on the right. This MVP is built for
          your two-day cycle: Day A upgrades a fresh essay into a teachable version, and Day
          B sharpens your rewrite into more stable, natural English.
        </p>
      </section>

      <section className="workspace">
        <div className="panel form-panel">
          <div className="panel-header">
            <div className="panel-header-copy">
              <h2>{copy.title}</h2>
              <p>{copy.subtitle}</p>
            </div>

            <div className="mode-tabs" role="tablist" aria-label="Training mode">
              <button
                type="button"
                className="mode-tab"
                aria-pressed={mode === "day-a"}
                onClick={() => setMode("day-a")}
              >
                <span>Day A</span>
              </button>
              <button
                type="button"
                className="mode-tab"
                aria-pressed={mode === "day-b"}
                onClick={() => setMode("day-b")}
              >
                <span>Day B</span>
              </button>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="essay">{copy.essayLabel}</label>
              <textarea
                id="essay"
                name="essay"
                placeholder={copy.essayPlaceholder}
                value={essay}
                onChange={(event) => setEssay(event.target.value)}
              />
              <p className="field-help">
                Submit is blocked if this field is empty. The assistant will still help if the
                draft is shorter than ideal.
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
                  onChange={(event) => setPhrasesInput(event.target.value)}
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
                  onChange={(event) => setKeywords(event.target.value)}
                />
                <p className="field-help">{copy.keywordsHelp}</p>
              </div>
            </div>

            {apiState.error ? <div className="message error">{apiState.error}</div> : null}

            {!apiState.error && !apiState.loading && apiState.output ? (
              <div className="message success">
                Response received. You can scroll the result panel and start your next rewrite
                cycle from there.
              </div>
            ) : null}

            <div className="actions">
              <button className="submit-button" type="submit" disabled={apiState.loading}>
                {apiState.loading ? "Submitting..." : "Submit to Schliemann"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="panel result-card">
        <h2>Assistant Response</h2>
        <p className="result-meta">
          {apiState.loading
            ? "Waiting for the assistant to finish the run..."
            : apiState.output
              ? "Latest response from your Schliemann assistant."
              : "Your result will appear here after submission."}
        </p>

        {apiState.output ? (
          <div className="response-content">{renderAssistantOutput(apiState.output)}</div>
        ) : (
          <div className="empty-state">
            <div>
              <strong>No response yet</strong>
              <p>
                Paste a draft, choose a mode, and submit. The app will send your writing to
                the server-side Gemini route and render the coaching output here.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
