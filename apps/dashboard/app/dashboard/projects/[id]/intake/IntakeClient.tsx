"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Project } from "../../../../../lib/api";
import {
  DECIDE,
  SECTIONS,
  askedQuestions,
  buildBlueprint,
  intakeProgress,
  isAnswered,
  optionsFor,
  questionById,
  skippedTopics,
  type Answer,
  type Answers,
  type Question,
} from "../../../../../lib/intake";
import type { ExperienceMode } from "../../../../../lib/mode";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from "../../../../landing-icons";
import ui from "../../../ui.module.css";
import BlueprintPanel from "../../BlueprintPanel";
import styles from "../../project.module.css";
import { saveAnswersAction } from "../../actions";

const SAVE_DELAY_MS = 600;

interface IntakeClientProps {
  project: Project;
  mode: ExperienceMode;
  /** Question to open on, e.g. when changing one answer from the Blueprint. */
  startAt?: string;
}

export default function IntakeClient({ project, mode, startAt }: IntakeClientProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(project.answers);
  const [lastAnswered, setLastAnswered] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startSave] = useTransition();
  const dirty = useRef(false);
  const latest = useRef(answers);
  latest.current = answers;

  const asked = useMemo(() => askedQuestions(answers), [answers]);
  const main = asked.filter((q) => !q.followUpOf);
  const progress = intakeProgress(answers);

  const [currentId, setCurrentId] = useState(() => startAt ?? progress.next?.id ?? main[0].id);
  // An answer can switch off the question being shown; fall back to the next one.
  const current = main.find((q) => q.id === currentId) ?? progress.next ?? main[0];
  const followUps = asked.filter((q) => q.followUpOf === current.id);

  const blueprint = useMemo(() => buildBlueprint(answers, project.name), [answers, project.name]);
  const added = useMemo(() => {
    if (!lastAnswered) return [];
    const { [lastAnswered]: _, ...before } = answers;
    const had = new Set(buildBlueprint(before, project.name).standards.map((s) => s.id));
    return blueprint.standards.filter((s) => !had.has(s.id)).map((s) => s.id);
  }, [answers, blueprint, lastAnswered, project.name]);

  function save(): Promise<void> {
    dirty.current = false;
    setSaveState("saving");
    return new Promise((resolve) => {
      startSave(async () => {
        const result = await saveAnswersAction(project.id, latest.current);
        if (result.ok) {
          setSaveState(dirty.current ? "saving" : "saved");
          setSaveError(null);
        } else {
          setSaveState("error");
          setSaveError(result.error);
        }
        resolve();
      });
    });
  }

  useEffect(() => {
    if (!dirty.current) return undefined;
    const timer = window.setTimeout(save, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  function answer(id: string, value: Answer) {
    dirty.current = true;
    setSaveState("saving");
    setLastAnswered(id);
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function flushAndGo(href: string) {
    if (dirty.current || saveState === "saving") await save();
    router.push(href);
  }

  const index = main.indexOf(current);
  const number = asked.indexOf(current) + 1;
  const section = SECTIONS.find((s) => s.id === current.section)!;
  const sectionQs = asked.filter((q) => q.section === current.section);
  const canContinue = isAnswered(current, answers) || (current.kind === "multi" && answers[current.id] === undefined);
  const isLast = index === main.length - 1;

  function goNext() {
    // Moving past a multi-choice question with nothing picked records "none of these".
    if (current.kind === "multi" && answers[current.id] === undefined) answer(current.id, []);
    if (isLast) {
      void flushAndGo(`/dashboard/projects/${project.id}/blueprint`);
      return;
    }
    setCurrentId(main[index + 1].id);
    window.scrollTo({ top: 0 });
  }

  function jumpToSection(sectionId: string) {
    const qs = main.filter((q) => q.section === sectionId);
    const open = qs.find((q) => asked.some((a) => (a === q || a.followUpOf === q.id) && !isAnswered(a, answers)));
    const target = open ?? qs[0];
    if (target) setCurrentId(target.id);
  }

  const skipped = skippedTopics(answers);

  return (
    <div className={styles.intake}>
      <header className={styles.intakeBar}>
        <div className={styles.intakeTitle}>
          <button type="button" className={`${ui.backLink} ${styles.plainBtn}`} onClick={() => flushAndGo("/dashboard")}>
            <ChevronLeftIcon size={15} />
            Projects
          </button>
          <span className={styles.divider} aria-hidden="true" />
          <div>
            <p className={styles.barName}>{project.name}</p>
            <p className={styles.barSub} aria-live="polite">
              New project ·{" "}
              {saveState === "error" ? (
                <span className={ui["text-red"]}>not saved: {saveError}</span>
              ) : saveState === "saving" ? (
                "saving…"
              ) : (
                "answers save as you go"
              )}
            </p>
          </div>
        </div>
        <div className={styles.intakeRight}>
          <div className={styles.meter}>
            <span>
              {progress.answered} of about {progress.total} questions
            </span>
            <div
              className={styles.meterTrack}
              role="progressbar"
              aria-label="Intake progress"
              aria-valuenow={progress.answered}
              aria-valuemin={0}
              aria-valuemax={progress.total}
            >
              <div style={{ width: `${(progress.answered / progress.total) * 100}%` }} />
            </div>
          </div>
          <button type="button" className={ui.btn} onClick={() => flushAndGo("/dashboard")}>
            Save and exit
          </button>
        </div>
      </header>

      <div className={styles.intakeGrid}>
        <nav className={styles.rail} aria-label="Sections">
          <p className={ui.eyebrow}>Sections</p>
          <ol className={styles.railList}>
            {SECTIONS.map((s, i) => {
              const qs = asked.filter((q) => q.section === s.id);
              const done = qs.length > 0 && qs.every((q) => isAnswered(q, answers));
              const active = s.id === current.section;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`${styles.railItem} ${active ? styles.railActive : ""}`}
                    aria-current={active ? "step" : undefined}
                    onClick={() => jumpToSection(s.id)}
                  >
                    <span className={`${styles.railDot} ${done && !active ? styles.railDotDone : ""}`}>
                      {done && !active ? <CheckIcon size={13} /> : i + 1}
                    </span>
                    <span className={styles.railLabel}>{s.label}</span>
                    <span className={styles.railMeta}>
                      {active ? `${sectionQs.indexOf(current) + 1} of ${sectionQs.length}` : done ? "Done" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {mode !== "expert" && (
            <p className={styles.railNote}>
              Sections and questions change with your answers. Skipped topics are listed here so you can see
              what we left out and why.
            </p>
          )}
          {skipped.length > 0 && (
            <details className={styles.skipped}>
              <summary>Skipped · {skipped.length}</summary>
              <ul>
                {skipped.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </details>
          )}
        </nav>

        <div className={styles.questionCol}>
          <section className={`${ui.card} ${styles.qCard}`} aria-labelledby="q-title">
            <p className={ui.eyebrow}>
              {section.label} · Question {number}
            </p>
            <h1 id="q-title" className={styles.qTitle}>
              {current.title}
            </h1>
            {current.help && <p className={styles.qHelp}>{current.help}</p>}
            <QuestionInput key={current.id} question={current} answers={answers} onAnswer={answer} />
            {current.why && mode !== "expert" && (
              <details className={styles.why} open={mode === "guided"}>
                <summary>Why we ask</summary>
                <p>{typeof current.why === "function" ? current.why(answers) : current.why}</p>
              </details>
            )}
          </section>

          {followUps.map((f) => (
            <FollowUp key={f.id} question={f} answers={answers} onAnswer={answer} />
          ))}

          <div className={styles.qNav}>
            {index > 0 ? (
              <button
                type="button"
                className={`${ui.btnGhost} ${styles.backBtn}`}
                onClick={() => setCurrentId(main[index - 1].id)}
              >
                <ChevronLeftIcon size={15} /> Back
              </button>
            ) : (
              <span />
            )}
            <div className={styles.qNavRight}>
              <span className={ui.muted}>You can change any answer later</span>
              <button type="button" className={ui.btnPrimary} onClick={goNext} disabled={!canContinue}>
                {isLast ? "See the Blueprint" : "Continue"} <ChevronRightIcon size={15} />
              </button>
            </div>
          </div>
        </div>

        <BlueprintPanel
          blueprint={blueprint}
          status={lastAnswered ? "Updated just now" : "From your answers"}
          added={added}
        />
      </div>
    </div>
  );
}

interface InputProps {
  question: Question;
  answers: Answers;
  onAnswer: (id: string, value: Answer) => void;
}

function QuestionInput({ question, answers, onAnswer }: InputProps) {
  const value = answers[question.id];

  if (question.kind === "text") {
    return (
      <textarea
        className={`${ui.input} ${styles.textAnswer}`}
        aria-labelledby="q-title"
        placeholder={question.placeholder}
        defaultValue={typeof value === "string" ? value : ""}
        rows={3}
        maxLength={600}
        onChange={(e) => onAnswer(question.id, e.target.value)}
      />
    );
  }

  const options = optionsFor(question, answers);
  const multi = question.kind === "multi";
  const picked = Array.isArray(value) ? value : [];
  const decided = value === DECIDE;

  return (
    <div className={styles.options} role={multi ? "group" : "radiogroup"} aria-labelledby="q-title">
      {options.map((o) => {
        const checked = multi ? picked.includes(o.id) : value === o.id;
        return (
          <label key={o.id} className={`${styles.option} ${checked ? styles.optionOn : ""}`}>
            <input
              type={multi ? "checkbox" : "radio"}
              name={question.id}
              checked={checked}
              onChange={() =>
                onAnswer(
                  question.id,
                  multi ? (checked ? picked.filter((p) => p !== o.id) : [...picked, o.id]) : o.id
                )
              }
              className={multi ? styles.check : styles.radio}
            />
            <span>
              <span className={styles.optionLabel}>{o.label}</span>
              {o.hint && <span className={styles.optionHint}>{o.hint}</span>}
            </span>
          </label>
        );
      })}
      {question.decide && (
        <label className={`${styles.option} ${styles.optionDecide} ${decided ? styles.optionOn : ""}`}>
          <input
            type="radio"
            name={question.id}
            checked={decided}
            onChange={() => onAnswer(question.id, DECIDE)}
            className={styles.radio}
          />
          <span>
            <span className={styles.optionLabel}>Not sure, decide for me</span>
            <span className={styles.optionHint}>
              {decided ? question.decide.because : "We pick the safe default and explain it"}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

function FollowUp({ question, answers, onAnswer }: InputProps) {
  const value = answers[question.id];
  const source = question.basedOn ? questionById(question.basedOn) : undefined;
  const quote = source && typeof answers[source.id] === "string" ? (answers[source.id] as string).trim() : "";
  const sourceNumber = source ? askedQuestions(answers).indexOf(source) + 1 : 0;

  return (
    <section className={`${ui.card} ${styles.followUp}`} aria-labelledby={`fu-${question.id}`}>
      <p className={styles.followTag}>
        <SparklesIcon size={14} /> Follow-up from your earlier answer
      </p>
      <h2 id={`fu-${question.id}`} className={styles.followTitle}>
        {question.title}
      </h2>
      {quote && (
        <p className={styles.followQuote}>
          Based on question {sourceNumber}: &ldquo;{quote.length > 140 ? `${quote.slice(0, 140)}…` : quote}&rdquo;
        </p>
      )}
      <div className={styles.pills} role="radiogroup" aria-labelledby={`fu-${question.id}`}>
        {optionsFor(question, answers).map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            className={`${styles.pill} ${value === o.id ? styles.pillOn : ""}`}
            onClick={() => onAnswer(question.id, o.id)}
          >
            {o.label}
          </button>
        ))}
        {question.decide && (
          <button
            type="button"
            role="radio"
            aria-checked={value === DECIDE}
            className={`${styles.pill} ${styles.pillDecide} ${value === DECIDE ? styles.pillOn : ""}`}
            onClick={() => onAnswer(question.id, DECIDE)}
          >
            Not sure
          </button>
        )}
      </div>
    </section>
  );
}
