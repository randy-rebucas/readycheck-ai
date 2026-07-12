const GIT_URL_PATTERN = /^(https?:\/\/|git@)\S+\.git$|^https?:\/\/(github|gitlab|bitbucket)\.com\/\S+$/i;

export interface TriggerScanDto {
  path?: string;
  repoUrl?: string;
}

export interface ResolvedScanSource {
  source: string;
  isGitUrl: boolean;
}

export function isGitUrl(value: string): boolean {
  return GIT_URL_PATTERN.test(value);
}

/** Returns null if neither path nor repoUrl was provided. */
export function resolveScanSource(dto: TriggerScanDto): ResolvedScanSource | null {
  const path = dto.path?.trim();
  const repoUrl = dto.repoUrl?.trim();

  if (!path && !repoUrl) return null;

  const gitUrl = Boolean(repoUrl) || (path ? isGitUrl(path) : false);
  return { source: repoUrl ?? path!, isGitUrl: gitUrl };
}
