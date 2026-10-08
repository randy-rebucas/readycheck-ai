"use client";

import { useState } from "react";
import type { Blueprint } from "../../../lib/intake";
import styles from "./project.module.css";

interface BlueprintPanelProps {
  blueprint: Blueprint;
  /** Shown top right of the navy card, e.g. "Updated just now". */
  status: string;
  /** Standard ids added by the most recent answer; highlighted. */
  added?: string[];
}

/** The live Blueprint column: summary, stack, standards and first-release features. */
export default function BlueprintPanel({ blueprint, status, added = [] }: BlueprintPanelProps) {
  const [showWhy, setShowWhy] = useState(false);
  const addedLabels = blueprint.standards.filter((s) => added.includes(s.id));

  return (
    <aside className={styles.blueprint} aria-label="Live blueprint">
      <section className={styles.bpHero}>
        <div className={styles.bpHeroTop}>
          <span className={styles.bpEyebrow}>Live blueprint</span>
          <span className={styles.bpStatus}>{status}</span>
        </div>
        <h2 className={styles.bpTitle}>{blueprint.title}</h2>
        <p className={styles.bpFacts}>{blueprint.facts.join(" · ") || "Answer a few questions to start"}</p>
        <div className={styles.bpTiles}>
          <div className={styles.bpTile}>
            <span className={styles.bpEyebrow}>Screens</span>
            <strong>{blueprint.screens ?? "—"}</strong>
          </div>
          <div className={styles.bpTile}>
            <span className={styles.bpEyebrow}>Hosting est.</span>
            <strong>
              {blueprint.hosting ?? "—"}
              {blueprint.hosting && <small> / mo</small>}
            </strong>
          </div>
        </div>
      </section>

      <section className={styles.bpCard}>
        <h3 className={styles.bpCardTitle}>Recommended stack</h3>
        {blueprint.stack.length === 0 ? (
          <p className={styles.bpNote}>Appears once you say what you&apos;re building.</p>
        ) : (
          <>
            <dl className={styles.bpStack}>
              {blueprint.stack.map((row) => (
                <div key={row.role}>
                  <dt>{row.role}</dt>
                  <dd>{row.choice}</dd>
                  {showWhy && <p className={styles.bpWhy}>{row.reason}</p>}
                </div>
              ))}
            </dl>
            <button type="button" className={styles.bpLink} onClick={() => setShowWhy((v) => !v)}>
              {showWhy ? "Hide reasons" : "Why this stack"}
            </button>
          </>
        )}
      </section>

      <section className={styles.bpCard}>
        <h3 className={styles.bpCardTitle}>Standards that will apply</h3>
        {blueprint.standards.length === 0 ? (
          <p className={styles.bpNote}>Set by your answers about the app, its users and their data.</p>
        ) : (
          <ul className={styles.bpChips}>
            {blueprint.standards.map((s) => (
              <li
                key={s.id}
                className={`${styles.bpChip} ${added.includes(s.id) ? styles.bpChipAdded : ""}`}
                title={s.reason}
              >
                {added.includes(s.id) && "+ "}
                {s.label}
              </li>
            ))}
          </ul>
        )}
        {(addedLabels.length > 0 || blueprint.offNotes.length > 0) && (
          <p className={styles.bpNote}>
            {addedLabels.length > 0 && `Added by your last answer. `}
            {blueprint.offNotes.join(" ")}
          </p>
        )}
      </section>

      <section className={styles.bpCard}>
        <h3 className={styles.bpCardTitle}>MVP features</h3>
        {blueprint.mvp.length + blueprint.later.length === 0 ? (
          <p className={styles.bpNote}>Filled in from the features you pick.</p>
        ) : (
          <ul className={styles.bpFeatures}>
            {blueprint.mvp.map((f) => (
              <li key={f}>{f}</li>
            ))}
            {blueprint.later.map((f) => (
              <li key={f} className={styles.bpLater}>
                {f} · later release
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
