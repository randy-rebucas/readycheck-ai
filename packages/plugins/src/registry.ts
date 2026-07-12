import type { RepoFacts } from "@readycheck/scanner";
import type { Issue } from "@readycheck/rules";
import type { FrameworkPlugin } from "./types";
import { nextjsPlugin } from "./nextjs/plugin";

const ALL_PLUGINS: FrameworkPlugin[] = [nextjsPlugin];

export function getApplicablePlugins(facts: RepoFacts): FrameworkPlugin[] {
  return ALL_PLUGINS.filter((plugin) => plugin.detect(facts));
}

export function evaluatePlugins(rootPath: string, facts: RepoFacts): Issue[] {
  return getApplicablePlugins(facts).flatMap((plugin) => plugin.evaluate(rootPath, facts));
}
