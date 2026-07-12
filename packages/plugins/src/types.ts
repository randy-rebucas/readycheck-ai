import type { RepoFacts } from "@readycheck/scanner";
import type { Issue } from "@readycheck/rules";

export interface FrameworkPlugin {
  id: string;
  /** Does this plugin apply to a repo with these facts? */
  detect(facts: RepoFacts): boolean;
  /** Framework-specific checks. Plugins may read the filesystem directly (rootPath),
   * since framework conventions (e.g. Next.js app/ vs pages/) aren't part of the
   * generic RepoFacts the core scanner produces. */
  evaluate(rootPath: string, facts: RepoFacts): Issue[];
}
