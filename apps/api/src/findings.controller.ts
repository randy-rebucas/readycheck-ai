import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { answerAboutFinding } from "@readycheck/ai";
import { getPrismaClient } from "@readycheck/db";
import { parseGitHubRepo } from "@readycheck/github";
import { getFixQueue } from "@readycheck/queue";
import { fixInfo } from "@readycheck/rules";
import { ApiKeyGuard } from "./api-key.guard";
import { orgGitHub, orgOwnsRepo, pullStatus, type PullStatus } from "./github-access";
import { CurrentTenant, type Tenant } from "./tenancy/tenant";

const prisma = getPrismaClient();

const MAX_REASON = 500;
const MAX_QUESTION = 1000;
const ACTIVE_FIX = ["queued", "working", "opened"];

export interface TriageDto {
  repoPath: string;
  ruleId: string;
  assigneeId: string | null;
  dueDate: string | null;
  dismissedAt: string | null;
  dismissReason: string | null;
}

export interface FixRequestDto {
  id: string;
  scanId: string;
  repoPath: string;
  ruleIds: string[];
  status: string;
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  summary: string | null;
  diff: string | null;
  verification: { resolved: string[]; stillOpen: string[]; introduced: string[] } | null;
  error: string | null;
  createdAt: string;
  pull: PullStatus | null;
}

type FixRow = Awaited<ReturnType<typeof prisma.fixRequest.findFirstOrThrow>>;

/** Brings opened PRs up to date with GitHub (merged or closed) and attaches CI checks. */
async function withPullStatus(orgId: string, rows: FixRow[]): Promise<FixRequestDto[]> {
  const open = rows.filter((r) => r.status === "opened" && r.prNumber);
  const github = open.length ? await orgGitHub(orgId) : null;
  return Promise.all(
    rows.map(async (r) => {
      let pull: PullStatus | null = null;
      let status = r.status;
      if (github && r.status === "opened" && r.prNumber) {
        pull = await pullStatus(github.client, r.repoPath, r.prNumber);
        if (pull && pull.state !== "open") {
          status = pull.state;
          await prisma.fixRequest.update({ where: { id: r.id }, data: { status } });
        }
      }
      return {
        id: r.id,
        scanId: r.scanId,
        repoPath: r.repoPath,
        ruleIds: r.ruleIds,
        status,
        branch: r.branch,
        prNumber: r.prNumber,
        prUrl: r.prUrl,
        summary: r.summary,
        diff: r.diff,
        verification: r.verification as FixRequestDto["verification"],
        error: r.error,
        createdAt: r.createdAt.toISOString(),
        pull,
      };
    })
  );
}

async function findOrgScan(tenant: Tenant, id: string) {
  const scan = await prisma.scan.findFirst({ where: { id, orgId: tenant.orgId }, include: { issues: true } });
  if (!scan) throw new NotFoundException(`No scan found with id ${id}`);
  return scan;
}

@Controller()
@UseGuards(ApiKeyGuard)
export class FindingsController {
  // ---------- Triage ----------

  @Get("triage")
  async triage(@CurrentTenant() tenant: Tenant, @Query("repoPath") repoPath?: string): Promise<TriageDto[]> {
    const rows = await prisma.findingTriage.findMany({
      where: { orgId: tenant.orgId, ...(repoPath ? { repoPath } : {}) },
    });
    return rows.map((t) => ({
      repoPath: t.repoPath,
      ruleId: t.ruleId,
      assigneeId: t.assigneeId,
      dueDate: t.dueDate?.toISOString() ?? null,
      dismissedAt: t.dismissedAt?.toISOString() ?? null,
      dismissReason: t.dismissReason,
    }));
  }

  /** Sets any of: assignee, due date, dismissed (with a reason). Omitted fields are left alone. */
  @Put("triage")
  async setTriage(
    @CurrentTenant() tenant: Tenant,
    @Body() body: { repoPath?: unknown; ruleId?: unknown; assigneeId?: unknown; dueDate?: unknown; dismissed?: unknown; reason?: unknown }
  ): Promise<TriageDto> {
    const repoPath = typeof body.repoPath === "string" ? body.repoPath : "";
    const ruleId = typeof body.ruleId === "string" ? body.ruleId : "";
    if (!repoPath || !ruleId) throw new BadRequestException("repoPath and ruleId are required.");
    if (!(await orgOwnsRepo(tenant.orgId, repoPath))) throw new NotFoundException("Unknown repository.");

    const data: {
      assigneeId?: string | null;
      dueDate?: Date | null;
      dismissedAt?: Date | null;
      dismissReason?: string | null;
      dismissedById?: string | null;
    } = {};
    if (body.assigneeId !== undefined) {
      if (body.assigneeId === null || body.assigneeId === "") data.assigneeId = null;
      else if (typeof body.assigneeId === "string") {
        const member = await prisma.membership.findUnique({
          where: { orgId_userId: { orgId: tenant.orgId, userId: body.assigneeId } },
        });
        if (!member) throw new BadRequestException("Assignee must be a member of this organization.");
        data.assigneeId = body.assigneeId;
      } else throw new BadRequestException("assigneeId must be a user id or null.");
    }
    if (body.dueDate !== undefined) {
      if (body.dueDate === null || body.dueDate === "") data.dueDate = null;
      else if (typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
        data.dueDate = new Date(`${body.dueDate}T00:00:00Z`);
      } else throw new BadRequestException("dueDate must be YYYY-MM-DD or null.");
    }
    if (body.dismissed !== undefined) {
      if (body.dismissed === true) {
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (!reason || reason.length > MAX_REASON) {
          throw new BadRequestException(`Say why it doesn't apply (1-${MAX_REASON} characters).`);
        }
        Object.assign(data, { dismissedAt: new Date(), dismissReason: reason, dismissedById: tenant.userId });
      } else Object.assign(data, { dismissedAt: null, dismissReason: null, dismissedById: null });
    }

    const t = await prisma.findingTriage.upsert({
      where: { orgId_repoPath_ruleId: { orgId: tenant.orgId, repoPath, ruleId } },
      create: { orgId: tenant.orgId, repoPath, ruleId, ...data },
      update: data,
    });
    return {
      repoPath: t.repoPath,
      ruleId: t.ruleId,
      assigneeId: t.assigneeId,
      dueDate: t.dueDate?.toISOString() ?? null,
      dismissedAt: t.dismissedAt?.toISOString() ?? null,
      dismissReason: t.dismissReason,
    };
  }

  // ---------- Automatic fixes ----------

  /** Every fix request for the scan's repository (they outlive the scan they started from). */
  @Get("scans/:id/fixes")
  async scanFixes(@CurrentTenant() tenant: Tenant, @Param("id") id: string): Promise<FixRequestDto[]> {
    const scan = await findOrgScan(tenant, id);
    const rows = await prisma.fixRequest.findMany({
      where: { orgId: tenant.orgId, repoPath: scan.path },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return withPullStatus(tenant.orgId, rows);
  }

  @Get("fixes")
  async fixes(@CurrentTenant() tenant: Tenant): Promise<FixRequestDto[]> {
    const rows = await prisma.fixRequest.findMany({
      where: { orgId: tenant.orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return withPullStatus(tenant.orgId, rows);
  }

  /** Queues a branch + pull request fixing the given findings of a completed scan. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("scans/:id/fixes")
  async createFix(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Body() body: { ruleIds?: unknown }
  ): Promise<FixRequestDto> {
    const scan = await findOrgScan(tenant, id);
    if (scan.status !== "completed") throw new BadRequestException("Fixes start from a completed scan.");
    if (!parseGitHubRepo(scan.path)) {
      throw new BadRequestException("Automatic fixes need a github.com repository. Follow the guided steps instead.");
    }
    if (!(await orgGitHub(tenant.orgId))) {
      throw new ConflictException("Connect GitHub in Settings so ReadyCheck can open pull requests.");
    }

    const ruleIds = Array.isArray(body.ruleIds) ? [...new Set(body.ruleIds.filter((r) => typeof r === "string"))] : [];
    if (ruleIds.length === 0 || ruleIds.length > 20) throw new BadRequestException("Pick 1-20 findings to fix.");
    const found = new Set(scan.issues.map((i) => i.ruleId));
    for (const ruleId of ruleIds) {
      if (!found.has(ruleId)) throw new BadRequestException(`${ruleId} isn't a finding of this scan.`);
      if (fixInfo(ruleId).kind === "guided") throw new BadRequestException(`${ruleId} has no automatic fix.`);
    }

    const active = await prisma.fixRequest.findFirst({
      where: { orgId: tenant.orgId, repoPath: scan.path, status: { in: ACTIVE_FIX }, ruleIds: { hasSome: ruleIds } },
    });
    if (active) throw new ConflictException("A fix for this finding is already in progress or awaiting review.");

    const fix = await prisma.fixRequest.create({
      data: { orgId: tenant.orgId, userId: tenant.userId, scanId: scan.id, repoPath: scan.path, ruleIds },
    });
    await getFixQueue().add("fix", { fixRequestId: fix.id }, { jobId: fix.id });
    return (await withPullStatus(tenant.orgId, [fix]))[0];
  }

  @Post("fixes/:id/retry")
  async retryFix(@CurrentTenant() tenant: Tenant, @Param("id") id: string): Promise<FixRequestDto> {
    const fix = await prisma.fixRequest.findFirst({ where: { id, orgId: tenant.orgId } });
    if (!fix) throw new NotFoundException(`No fix found with id ${id}`);
    if (fix.status !== "failed") throw new BadRequestException("Only failed fixes can be retried.");
    const updated = await prisma.fixRequest.update({ where: { id }, data: { status: "queued", error: null } });
    await getFixQueue().add("fix", { fixRequestId: id }, { jobId: `${id}-${Date.now()}` });
    return (await withPullStatus(tenant.orgId, [updated]))[0];
  }

  // ---------- Assistant ----------

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("scans/:id/issues/:issueId/ask")
  async ask(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Param("issueId") issueId: string,
    @Body() body: { question?: unknown }
  ): Promise<{ answer: string }> {
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > MAX_QUESTION) {
      throw new BadRequestException(`Ask a question (1-${MAX_QUESTION} characters).`);
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ServiceUnavailableException("The assistant isn't configured (ANTHROPIC_API_KEY on the API).");
    }
    const scan = await findOrgScan(tenant, id);
    const issue = scan.issues.find((i) => i.id === issueId);
    if (!issue) throw new NotFoundException(`No finding ${issueId} in this scan.`);

    const answer = await answerAboutFinding({
      question,
      finding: `${issue.ruleId} (${issue.severity}, ${issue.category}): ${issue.message}\nRecommendation: ${issue.recommendation}`,
      context: JSON.stringify({ repository: scan.path, facts: scan.facts }, null, 2),
    });
    return { answer };
  }
}
