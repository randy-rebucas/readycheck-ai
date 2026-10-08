import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { getPrismaClient, type Prisma } from "@readycheck/db";
import { parseGitHubRepo } from "@readycheck/github";
import { getBuildQueue } from "@readycheck/queue";
import { ApiKeyGuard } from "./api-key.guard";
import { orgGitHub, pullStatus, type PullStatus } from "./github-access";
import { CurrentTenant, type Tenant } from "./tenancy/tenant";

const MAX_NAME = 80;
const MAX_ANSWERS_BYTES = 32_000;
const MAX_REPO_PATH = 500;
const MAX_SLICES = 20;
const MAX_STORIES = 12;
const MAX_SPEC = 8000;

/** Lifecycle stages that are completed by a person rather than by a scan. */
export const SIGNOFF_STAGES = ["plan", "design", "build", "uat", "deploy"] as const;
type SignoffStage = (typeof SIGNOFF_STAGES)[number];

const prisma = getPrismaClient();

export interface ProjectDto {
  id: string;
  name: string;
  answers: Record<string, unknown>;
  signoffs: Record<string, { at: string; by: string | null }>;
  repoPath: string | null;
  createdAt: string;
  updatedAt: string;
}

type ProjectRow = Awaited<ReturnType<typeof prisma.project.findFirstOrThrow>>;

function toDto(p: ProjectRow): ProjectDto {
  return {
    id: p.id,
    name: p.name,
    answers: (p.answers ?? {}) as ProjectDto["answers"],
    signoffs: (p.signoffs ?? {}) as ProjectDto["signoffs"],
    repoPath: p.repoPath,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function parseName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > MAX_NAME) {
    throw new BadRequestException(`Project name must be 1-${MAX_NAME} characters.`);
  }
  return name;
}

function parseAnswers(value: unknown): Prisma.InputJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("answers must be an object.");
  }
  if (JSON.stringify(value).length > MAX_ANSWERS_BYTES) {
    throw new BadRequestException("answers is too large.");
  }
  return value as Prisma.InputJsonObject;
}

/** Same rule as scans: only public http(s) git URLs are linkable. */
function parseRepoPath(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_REPO_PATH || !/^https?:\/\/\S+$/.test(value.trim())) {
    throw new BadRequestException("repoPath must be an http(s) repository URL.");
  }
  return value.trim();
}

export interface SliceDto {
  id: string;
  position: number;
  title: string;
  stories: string[];
  status: string;
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  summary: string | null;
  testsAdded: number | null;
  issuesFound: { ruleId: string; severity: string; message: string }[] | null;
  error: string | null;
  mergedAt: string | null;
  pull: PullStatus | null;
}

type SliceRow = Awaited<ReturnType<typeof prisma.buildSlice.findFirstOrThrow>>;

/** Picks up merges and closes from GitHub for slices awaiting review. */
async function withPullStatus(orgId: string, repoPath: string | null, rows: SliceRow[]): Promise<SliceDto[]> {
  const github = repoPath && rows.some((r) => r.status === "review") ? await orgGitHub(orgId) : null;
  return Promise.all(
    rows.map(async (r) => {
      let pull: PullStatus | null = null;
      let status = r.status;
      let mergedAt = r.mergedAt;
      if (github && repoPath && r.status === "review" && r.prNumber) {
        pull = await pullStatus(github.client, repoPath, r.prNumber);
        if (pull && pull.state !== "open") {
          status = pull.state;
          mergedAt = pull.mergedAt ? new Date(pull.mergedAt) : null;
          await prisma.buildSlice.update({ where: { id: r.id }, data: { status, mergedAt } });
        }
      }
      return {
        id: r.id,
        position: r.position,
        title: r.title,
        stories: r.stories,
        status,
        branch: r.branch,
        prNumber: r.prNumber,
        prUrl: r.prUrl,
        summary: r.summary,
        testsAdded: r.testsAdded,
        issuesFound: r.issuesFound as SliceDto["issuesFound"],
        error: r.error,
        mergedAt: mergedAt?.toISOString() ?? null,
        pull,
      };
    })
  );
}

/** Slices build one at a time, in order: enqueue the first queued one if nothing is generating. */
async function startNextSlice(projectId: string): Promise<void> {
  const busy = await prisma.buildSlice.count({ where: { projectId, status: "generating" } });
  if (busy > 0) return;
  const next = await prisma.buildSlice.findFirst({
    where: { projectId, status: "queued" },
    orderBy: { position: "asc" },
  });
  if (next) {
    await getBuildQueue().add("build-slice", { sliceId: next.id }, { jobId: `slice-${next.id}-${Date.now()}` });
  }
}

function parseSlices(value: unknown): { title: string; stories: string[] }[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SLICES) {
    throw new BadRequestException(`Provide 1-${MAX_SLICES} slices.`);
  }
  return value.map((v: { title?: unknown; stories?: unknown }) => {
    const title = typeof v?.title === "string" ? v.title.trim() : "";
    const stories = (Array.isArray(v?.stories) ? v.stories : [])
      .filter((s): s is string => typeof s === "string" && s.trim() !== "")
      .map((s) => s.trim());
    if (!title || title.length > 120 || stories.length === 0 || stories.length > MAX_STORIES) {
      throw new BadRequestException(`Each slice needs a title and 1-${MAX_STORIES} stories.`);
    }
    return { title, stories };
  });
}

async function listSlices(orgId: string, projectId: string, repoPath: string | null): Promise<SliceDto[]> {
  const rows = await prisma.buildSlice.findMany({ where: { projectId }, orderBy: { position: "asc" } });
  return withPullStatus(orgId, repoPath, rows);
}

/** Another org's project is reported as missing, not forbidden, so ids can't be probed. */
async function findOrgProject(tenant: Tenant, id: string): Promise<ProjectRow> {
  const project = await prisma.project.findFirst({ where: { id, orgId: tenant.orgId } });
  if (!project) throw new NotFoundException(`No project found with id ${id}`);
  return project;
}

@Controller("projects")
@UseGuards(ApiKeyGuard)
export class ProjectsController {
  @Get()
  async list(@CurrentTenant() tenant: Tenant): Promise<ProjectDto[]> {
    const projects = await prisma.project.findMany({
      where: { orgId: tenant.orgId },
      orderBy: { updatedAt: "desc" },
    });
    return projects.map(toDto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(@CurrentTenant() tenant: Tenant, @Body() body: { name?: unknown }): Promise<ProjectDto> {
    const project = await prisma.project.create({
      data: { name: parseName(body.name), orgId: tenant.orgId, userId: tenant.userId },
    });
    return toDto(project);
  }

  @Get(":id")
  async get(@CurrentTenant() tenant: Tenant, @Param("id") id: string): Promise<ProjectDto> {
    return toDto(await findOrgProject(tenant, id));
  }

  /** Intake saves every answer as it's given, so this is called often. */
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Patch(":id")
  async update(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Body() body: { name?: unknown; answers?: unknown; repoPath?: unknown }
  ): Promise<ProjectDto> {
    await findOrgProject(tenant, id);
    const data: Prisma.ProjectUpdateInput = {};
    if (body.name !== undefined) data.name = parseName(body.name);
    if (body.answers !== undefined) data.answers = parseAnswers(body.answers);
    if (body.repoPath !== undefined) data.repoPath = parseRepoPath(body.repoPath);
    return toDto(await prisma.project.update({ where: { id }, data }));
  }

  // ---------- Build slices ----------

  @Get(":id/slices")
  async slices(@CurrentTenant() tenant: Tenant, @Param("id") id: string): Promise<SliceDto[]> {
    const project = await findOrgProject(tenant, id);
    return listSlices(tenant.orgId, id, project.repoPath);
  }

  /**
   * Replaces the not-yet-started slices with a new plan (from the approved
   * Blueprint). Slices already queued, building, in review or merged are kept.
   */
  @Post(":id/slices")
  async planSlices(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Body() body: { slices?: unknown; spec?: unknown }
  ): Promise<SliceDto[]> {
    const project = await findOrgProject(tenant, id);
    const slices = parseSlices(body.slices);
    const spec = typeof body.spec === "string" ? body.spec.trim().slice(0, MAX_SPEC) : "";
    if (!spec) throw new BadRequestException("spec is required.");

    await prisma.$transaction(async (tx) => {
      await tx.buildSlice.deleteMany({ where: { projectId: id, status: { in: ["planned", "failed"] } } });
      const kept = await tx.buildSlice.aggregate({ where: { projectId: id }, _max: { position: true } });
      const start = (kept._max.position ?? 0) + 1;
      await tx.buildSlice.createMany({
        data: slices.map((s, i) => ({
          projectId: id,
          orgId: tenant.orgId,
          position: start + i,
          title: s.title,
          stories: s.stories,
          spec,
        })),
      });
    });
    return listSlices(tenant.orgId, id, project.repoPath);
  }

  /** Queues every planned slice and starts the first. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":id/slices/start")
  async startBuild(@CurrentTenant() tenant: Tenant, @Param("id") id: string): Promise<SliceDto[]> {
    const project = await findOrgProject(tenant, id);
    if (!project.repoPath || !parseGitHubRepo(project.repoPath)) {
      throw new BadRequestException("Connect a github.com repository to the project first.");
    }
    if (!(await orgGitHub(tenant.orgId))) {
      throw new ConflictException("Connect GitHub in Settings so ReadyCheck can open pull requests.");
    }
    const { count } = await prisma.buildSlice.updateMany({
      where: { projectId: id, status: "planned" },
      data: { status: "queued" },
    });
    if (count === 0) throw new BadRequestException("No planned slices to build.");
    await startNextSlice(id);
    return listSlices(tenant.orgId, id, project.repoPath);
  }

  @Post(":id/slices/:sliceId/retry")
  async retrySlice(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Param("sliceId") sliceId: string
  ): Promise<SliceDto[]> {
    const project = await findOrgProject(tenant, id);
    const { count } = await prisma.buildSlice.updateMany({
      where: { id: sliceId, projectId: id, status: { in: ["failed", "closed"] } },
      data: { status: "queued", error: null, prNumber: null, prUrl: null, branch: null },
    });
    if (count === 0) throw new BadRequestException("Only failed or closed slices can be retried.");
    await startNextSlice(id);
    return listSlices(tenant.orgId, id, project.repoPath);
  }

  /** Marks a hand-completed lifecycle stage done (or undoes it). */
  @Post(":id/signoffs")
  async signoff(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Body() body: { stage?: unknown; done?: unknown }
  ): Promise<ProjectDto> {
    const project = await findOrgProject(tenant, id);
    const stage = body.stage as SignoffStage;
    if (!(SIGNOFF_STAGES as readonly unknown[]).includes(stage)) {
      throw new BadRequestException(`stage must be one of ${SIGNOFF_STAGES.join(", ")}.`);
    }
    const signoffs = { ...((project.signoffs ?? {}) as Record<string, unknown>) };
    if (body.done === false) delete signoffs[stage];
    else signoffs[stage] = { at: new Date().toISOString(), by: tenant.userId };
    const updated = await prisma.project.update({
      where: { id },
      data: { signoffs: signoffs as Prisma.InputJsonObject },
    });
    return toDto(updated);
  }
}
