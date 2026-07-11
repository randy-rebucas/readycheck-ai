export interface RepoFacts {
  rootPath: string;
  languages: string[];
  packageManager: "npm" | "yarn" | "pnpm" | "unknown";
  frameworks: string[];
  hasDocker: boolean;
  hasKubernetes: boolean;
  hasTerraform: boolean;
  ciProviders: string[];
  hasTests: boolean;
  hasEnvFiles: boolean;
  hasLicense: boolean;
}
