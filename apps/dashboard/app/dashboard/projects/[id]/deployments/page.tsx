import Link from "next/link";
import ui from "../../../ui.module.css";
import DeploymentList from "../../../deployments/DeploymentList";
import { loadProject } from "../data";
import ProjectHeader from "../ProjectHeader";
import StageAction from "../StageAction";

export const metadata = {
  title: "Deployments — ReadyCheck AI",
};

export default async function ProjectDeploymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  const { project, deployments, deploymentsError, githubConnected } = data;

  return (
    <>
      <ProjectHeader data={data} tab="deployments" action={<StageAction data={data} />} />
      <main className={ui.page}>
        <section className={ui.card} aria-labelledby="deploy-title">
          <div className={ui.cardHead}>
            <div>
              <h2 id="deploy-title" className={ui.cardTitle}>
                Deployments
              </h2>
              <p className={ui.cardSub}>
                A successful <strong>production</strong> deployment completes the Deploy stage automatically.
              </p>
            </div>
          </div>
          {!project.repoPath ? (
            <div className={ui.empty}>
              Connect the project&apos;s repository on the{" "}
              <Link href={`/dashboard/projects/${project.id}`} className={ui.textLink}>
                Lifecycle
              </Link>{" "}
              tab first.
            </div>
          ) : !githubConnected ? (
            <div className={ui.empty}>
              <Link href="/dashboard/settings#github" className={ui.textLink}>
                Connect GitHub
              </Link>{" "}
              to read this repository&apos;s deployments.
            </div>
          ) : deploymentsError ? (
            <div className={ui.cardPad}>
              <p className={ui.error}>{deploymentsError}</p>
            </div>
          ) : deployments ? (
            <DeploymentList deployments={deployments} />
          ) : (
            <div className={ui.empty}>Deployments are only available for github.com repositories.</div>
          )}
        </section>
      </main>
    </>
  );
}
