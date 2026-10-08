import Link from "next/link";
import {
  SECTIONS,
  answerLabel,
  askedQuestions,
  buildBlueprint,
  intakeProgress,
  isAnswered,
  skippedTopics,
} from "../../../../../lib/intake";
import ui from "../../../ui.module.css";
import BlueprintPanel from "../../BlueprintPanel";
import styles from "../../project.module.css";
import { loadProject } from "../data";
import ProjectHeader from "../ProjectHeader";
import { SignoffButton } from "../StageAction";

export const metadata = {
  title: "Blueprint — ReadyCheck AI",
};

export default async function BlueprintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  const { project } = data;
  const answers = project.answers;
  const blueprint = buildBlueprint(answers, project.name);
  const intake = intakeProgress(answers);
  const asked = askedQuestions(answers);
  const approved = project.signoffs.plan;
  const pitch = typeof answers.pitch === "string" ? answers.pitch : "";
  const skipped = skippedTopics(answers);

  const action = !intake.complete ? (
    <Link href={`/dashboard/projects/${project.id}/intake`} className={ui.btnPrimary}>
      Resume intake
    </Link>
  ) : !approved ? (
    <SignoffButton projectId={project.id} stage="plan" primary />
  ) : null;

  return (
    <>
      <ProjectHeader data={data} tab="blueprint" action={action} />

      <main className={ui.page}>
        <div className={styles.bpGrid}>
          <div className={styles.lifeMain}>
            <section className={`${ui.card} ${ui.cardPad} ${styles.bpSummary}`}>
              <p className={ui.eyebrow}>
                {approved
                  ? `Approved ${new Date(approved.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : intake.complete
                    ? "Ready to approve"
                    : `Draft · ${intake.answered} of ${intake.total} answered`}
              </p>
              <h2 className={styles.bpSummaryTitle}>{pitch || project.name}</h2>
              <p className={ui.cardSub}>
                {approved
                  ? "The plan the build is measured against. Changing an answer updates it."
                  : "Check the answers below. Approving the Blueprint completes the Plan stage."}
              </p>
            </section>

            {blueprint.decisions.length > 0 && (
              <section className={ui.card} aria-labelledby="decided-title">
                <div className={styles.cardIntro}>
                  <h2 id="decided-title" className={ui.cardTitle}>
                    Decided for you
                  </h2>
                  <p className={ui.cardSub}>You picked &ldquo;Not sure&rdquo; on these, so we chose the safe default.</p>
                </div>
                <ul className={styles.answerList}>
                  {blueprint.decisions.map((d) => (
                    <li key={d.question}>
                      <span className={styles.answerQ}>{d.question}</span>
                      <span className={styles.answerA}>{d.choice}</span>
                      <span className={styles.answerWhy}>{d.because}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {SECTIONS.map((section) => {
              const qs = asked.filter((q) => q.section === section.id);
              if (qs.length === 0) return null;
              return (
                <section key={section.id} className={ui.card} aria-labelledby={`sec-${section.id}`}>
                  <div className={ui.cardHead}>
                    <h2 id={`sec-${section.id}`} className={ui.cardTitle}>
                      {section.label}
                    </h2>
                  </div>
                  <ul className={styles.answerList}>
                    {qs.map((q) => (
                      <li key={q.id}>
                        <span className={styles.answerQ}>{q.title}</span>
                        <span className={isAnswered(q, answers) ? styles.answerA : ui.muted}>
                          {isAnswered(q, answers) ? answerLabel(q, answers) || "None of these" : "Not answered yet"}
                        </span>
                        <Link
                          href={`/dashboard/projects/${project.id}/intake?q=${q.followUpOf ?? q.id}`}
                          className={styles.editLink}
                          aria-label={`Change answer: ${q.title}`}
                        >
                          Change
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {skipped.length > 0 && (
              <section className={`${ui.card} ${ui.cardPad}`}>
                <h2 className={ui.cardTitle}>Left out, and why</h2>
                <ul className={styles.skippedList}>
                  {skipped.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <BlueprintPanel blueprint={blueprint} status={approved ? "Approved" : "Draft"} />
        </div>
      </main>
    </>
  );
}
