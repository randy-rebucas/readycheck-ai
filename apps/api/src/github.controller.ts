import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { getPrismaClient } from "@readycheck/db";
import { GitHubClient, GitHubError, encryptSecret, parseGitHubRepo, type Deployment } from "@readycheck/github";
import { ApiKeyGuard } from "./api-key.guard";
import { orgGitHub, orgOwnsRepo } from "./github-access";
import { CurrentTenant, requireRole, type Tenant } from "./tenancy/tenant";

const prisma = getPrismaClient();

@Controller("github")
@UseGuards(ApiKeyGuard)
export class GitHubController {
  @Get("connection")
  async get(@CurrentTenant() tenant: Tenant): Promise<{ connected: boolean; login: string | null; connectedAt: string | null }> {
    const connection = await prisma.gitHubConnection.findUnique({ where: { orgId: tenant.orgId } });
    return {
      connected: Boolean(connection),
      login: connection?.login ?? null,
      connectedAt: connection?.createdAt.toISOString() ?? null,
    };
  }

  /**
   * Stores a GitHub token for the org (fine-grained: Contents, Pull requests
   * and Deployments read/write on the repositories in question). Checked
   * against GitHub before saving; stored encrypted and never returned.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Put("connection")
  async connect(@CurrentTenant() tenant: Tenant, @Body() body: { token?: unknown }) {
    requireRole(tenant, "admin");
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token || token.length > 400 || /\s/.test(token)) throw new BadRequestException("Paste a GitHub token.");

    let login: string;
    try {
      ({ login } = await new GitHubClient(token).getUser());
    } catch (err) {
      const status = err instanceof GitHubError ? err.status : 0;
      throw new BadRequestException(
        status === 401 ? "GitHub rejected that token." : "Could not reach GitHub to check the token."
      );
    }

    const tokenEnc = encryptSecret(token);
    await prisma.gitHubConnection.upsert({
      where: { orgId: tenant.orgId },
      create: { orgId: tenant.orgId, tokenEnc, login },
      update: { tokenEnc, login },
    });
    return { connected: true, login };
  }

  @Delete("connection")
  async disconnect(@CurrentTenant() tenant: Tenant) {
    requireRole(tenant, "admin");
    await prisma.gitHubConnection.deleteMany({ where: { orgId: tenant.orgId } });
    return { connected: false };
  }

  /** Deployments GitHub knows about for one of the org's repositories (Vercel, Render, Netlify, Actions...). */
  @Get("deployments")
  async deployments(@CurrentTenant() tenant: Tenant, @Query("repoPath") repoPath?: string): Promise<Deployment[]> {
    const ref = repoPath ? parseGitHubRepo(repoPath) : null;
    if (!repoPath || !ref) throw new BadRequestException("repoPath must be a github.com repository URL.");
    if (!(await orgOwnsRepo(tenant.orgId, repoPath))) throw new NotFoundException("Unknown repository.");
    const github = await orgGitHub(tenant.orgId);
    if (!github) throw new ConflictException("Connect GitHub in Settings to see deployments.");
    try {
      return await github.client.listDeployments(ref);
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) {
        throw new NotFoundException(`The connected GitHub account (${github.login}) can't see this repository.`);
      }
      if (err instanceof GitHubError && (err.status === 401 || err.status === 403)) {
        // Expired or revoked token, or one without Deployments access.
        throw new ConflictException(
          `GitHub refused the stored token for ${github.login}. Reconnect GitHub in Settings with Deployments read access.`
        );
      }
      throw err;
    }
  }
}
