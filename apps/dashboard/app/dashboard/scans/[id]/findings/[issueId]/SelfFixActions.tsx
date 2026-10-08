"use client";

import { useState, useTransition } from "react";
import { triggerScanAction } from "../../../../../actions";
import { SparklesIcon } from "../../../../../landing-icons";
import ui from "../../../../ui.module.css";
import { askAction } from "../../../../fixes/actions";
import styles from "./finding.module.css";

/** "Verify my fix" and the assistant for the do-it-yourself path. */
export default function SelfFixActions({ scanId, issueId, repoPath }: { scanId: string; issueId: string; repoPath: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setError(null);
    startTransition(async () => {
      const result = await askAction(scanId, issueId, q);
      if (result.ok) {
        setAnswers((prev) => [...prev, { q, a: result.value }]);
        setQuestion("");
      } else setError(result.error);
    });
  }

  return (
    <>
      <div className={styles.selfButtons}>
        <form action={triggerScanAction}>
          <input type="hidden" name="path" value={repoPath} />
          <button type="submit" className={ui.btn}>
            Verify my fix
          </button>
        </form>
        <button
          type="button"
          className={`${ui.btn} ${styles.askBtn}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <SparklesIcon size={15} /> Ask the assistant
        </button>
      </div>
      <p className={ui.muted}>Push your change first. Verify re-scans the repository, and the finding drops off once it&apos;s resolved.</p>

      {open && (
        <div className={styles.assistant}>
          {answers.map((item, i) => (
            <div key={i} className={styles.qa}>
              <p className={styles.qaQ}>{item.q}</p>
              <p className={styles.qaA}>{item.a}</p>
            </div>
          ))}
          <form onSubmit={ask} className={styles.askForm}>
            <textarea
              className={ui.input}
              rows={2}
              maxLength={1000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Where do I set DATABASE_URL on Render?"
              aria-label="Question for the assistant"
            />
            <button type="submit" className={`${ui.btn} ${ui.btnSm}`} disabled={pending || !question.trim()}>
              {pending ? "Thinking…" : "Ask"}
            </button>
          </form>
          {error && <p className={ui.error}>{error}</p>}
        </div>
      )}
    </>
  );
}
