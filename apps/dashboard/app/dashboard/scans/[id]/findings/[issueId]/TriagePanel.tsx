"use client";

import { useState, useTransition } from "react";
import type { OrgMember, Triage } from "../../../../../../lib/api";
import ui from "../../../../ui.module.css";
import { triageAction } from "../../../../fixes/actions";
import styles from "./finding.module.css";

interface TriagePanelProps {
  repoPath: string;
  ruleId: string;
  members: OrgMember[];
  initial: Triage | null;
}

/** "Hand it to someone" and "This doesn't apply here". Saved per repository and rule. */
export default function TriagePanel({ repoPath, ruleId, members, initial }: TriagePanelProps) {
  const [triage, setTriage] = useState<Triage | null>(initial);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(patch: { assigneeId?: string | null; dueDate?: string | null; dismissed?: boolean; reason?: string }) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await triageAction({ repoPath, ruleId, ...patch });
      if (result.ok) {
        setTriage(result.value);
        setSaved(true);
        setDismissing(false);
      } else setError(result.error);
    });
  }

  return (
    <>
      <section className={`${ui.card} ${ui.cardPad}`} aria-labelledby="handoff-title">
        <h2 id="handoff-title" className={styles.sideTitle}>
          Hand it to someone
        </h2>
        <label className={styles.field}>
          <span>Assignee</span>
          <select
            className={ui.input}
            value={triage?.assigneeId ?? ""}
            onChange={(e) => save({ assigneeId: e.target.value || null })}
            disabled={pending}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name ?? m.email ?? m.userId}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Due</span>
          <input
            type="date"
            className={ui.input}
            value={triage?.dueDate?.slice(0, 10) ?? ""}
            onChange={(e) => save({ dueDate: e.target.value || null })}
            disabled={pending}
          />
        </label>
        <p className={styles.savedNote} aria-live="polite">
          {pending ? "Saving…" : saved ? "Saved" : ""}
        </p>
      </section>

      {triage?.dismissedAt ? (
        <div className={styles.dismissed}>
          <p>
            <strong>Marked as not applicable.</strong> {triage.dismissReason}
          </p>
          <button type="button" className={ui.textLink} onClick={() => save({ dismissed: false })} disabled={pending}>
            Undo
          </button>
        </div>
      ) : dismissing ? (
        <form
          className={`${ui.card} ${ui.cardPad} ${styles.dismissForm}`}
          onSubmit={(e) => {
            e.preventDefault();
            save({ dismissed: true, reason });
          }}
        >
          <label className={styles.field}>
            <span>Why doesn&apos;t it apply?</span>
            <textarea
              className={ui.input}
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. This repository is a library; it isn't deployed."
              required
              autoFocus
            />
          </label>
          <div className={ui.actions}>
            <button type="submit" className={`${ui.btn} ${ui.btnSm}`} disabled={pending || !reason.trim()}>
              Mark as not applicable
            </button>
            <button type="button" className={`${ui.btnGhost} ${ui.btnSm}`} onClick={() => setDismissing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={`${ui.textLink} ${styles.dismissLink}`} onClick={() => setDismissing(true)}>
          This doesn&apos;t apply here
        </button>
      )}
      {error && <p className={ui.error}>{error}</p>}
    </>
  );
}
