import Link from "next/link";
import { ChevronLeftIcon, LightbulbIcon } from "../../../landing-icons";
import ui from "../../ui.module.css";
import styles from "../project.module.css";
import { createProjectAction } from "../actions";

export const metadata = {
  title: "New project — ReadyCheck AI",
};

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className={ui.page}>
      <Link href="/dashboard" className={ui.backLink}>
        <ChevronLeftIcon size={15} />
        Projects
      </Link>

      <section className={`${ui.card} ${styles.newCard}`} aria-labelledby="new-title">
        <span className={styles.newIcon}>
          <LightbulbIcon size={22} />
        </span>
        <div className={styles.newBody}>
          <h1 id="new-title" className={styles.newTitle}>
            Build something new
          </h1>
          <p className={styles.newText}>
            Answer questions about your idea and get a Blueprint: the stack, the standards that apply, a
            hosting estimate and a plan to production. Answers save as you go, and you can change any of them
            later.
          </p>
          <form action={createProjectAction} className={styles.newForm}>
            <label htmlFor="project-name" className={styles.label}>
              What&apos;s the project called?
            </label>
            <div className={styles.newRow}>
              <input
                id="project-name"
                name="name"
                className={ui.input}
                placeholder="Kanto field app"
                maxLength={80}
                required
                autoFocus
              />
              <button type="submit" className={ui.btnPrimary}>
                Start intake
              </button>
            </div>
          </form>
          {error && <p className={ui.error}>{error}</p>}
          <p className={ui.muted}>About 15 to 30 questions, depending on the project.</p>
        </div>
      </section>
    </main>
  );
}
