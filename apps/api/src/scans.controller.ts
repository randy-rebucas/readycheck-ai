import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { getScanQueue } from "@readycheck/queue";
import { getPrismaClient } from "@readycheck/db";
import { generateReport, REPORT_CONTENT_TYPES, type ReportFormat } from "@readycheck/reports";
import { getEffectivePlan, planAllowsFormat, PLAN_LIMITS } from "@readycheck/billing";
import { ApiKeyGuard } from "./api-key.guard";
import { resolveScanSource, type TriggerScanDto } from "./scan-source";
import { CurrentTenant, type Tenant } from "./tenancy/tenant";

const REPORT_FORMATS: ReportFormat[] = ["json", "markdown", "csv", "html", "pdf"];
const REPORT_EXTENSIONS: Record<ReportFormat, string> = {
  json: "json",
  markdown: "md",
  csv: "csv",
  html: "html",
  pdf: "pdf",
};

const MAX_LIST_LIMIT = 100;

const prisma = getPrismaClient();

/**
 * Loads a scan only if it belongs to the caller's org. Another org's scan is
 * reported as missing (404), not forbidden, so ids can't be probed.
 */
async function findOrgScan(tenant: Tenant, id: string) {
  const scan = await prisma.scan.findFirst({ where: { id, orgId: tenant.orgId } });
  if (!scan) throw new NotFoundException(`No scan found with id ${id}`);
  return scan;
}

async function findOrgScanDetail(tenant: Tenant, id: string) {
  const scan = await prisma.scan.findFirst({
    where: { id, orgId: tenant.orgId },
    include: { issues: true, categoryScores: true },
  });
  if (!scan) throw new NotFoundException(`No scan found with id ${id}`);
  return scan;
}

@Controller("scans")
@UseGuards(ApiKeyGuard)
export class ScansController {
  // Scan triggering is the expensive/abusable action (spawns a clone + full
  // pipeline run), so it gets a tighter limit than the controller-wide default.
  // This flat 10/min limit applies to every plan; the plan-aware repository
  // and daily-scan limits below are enforced separately.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async trigger(@CurrentTenant() tenant: Tenant, @Body() dto: TriggerScanDto) {
    const resolved = resolveScanSource(dto);
    if (!resolved) {
      throw new BadRequestException("Provide either 'path' or 'repoUrl'.");
    }
    const { source, isGitUrl } = resolved;

    const subscription = await prisma.subscription.findUnique({ where: { orgId: tenant.orgId } });
    const plan = getEffectivePlan(subscription);
    const limits = PLAN_LIMITS[plan];

    const scannedPaths = await prisma.scan.findMany({
      where: { orgId: tenant.orgId },
      distinct: ["path"],
      select: { path: true },
    });
    const alreadyScanned = scannedPaths.some((s) => s.path === source);
    if (!alreadyScanned && scannedPaths.length >= limits.maxRepositories) {
      throw new ForbiddenException(
        `Free plan is limited to ${limits.maxRepositories} repository. Upgrade to Pro for unlimited projects.`
      );
    }

    if (Number.isFinite(limits.dailyScanLimit)) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await prisma.scan.count({
        where: { orgId: tenant.orgId, createdAt: { gte: since } },
      });
      if (recentCount >= limits.dailyScanLimit) {
        throw new ForbiddenException(
          `Free plan is limited to ${limits.dailyScanLimit} scans per day. Upgrade to Pro for unlimited scans.`
        );
      }
    }

    const scan = await prisma.scan.create({
      data: {
        path: source,
        sourceType: isGitUrl ? "git" : "local",
        status: "queued",
        orgId: tenant.orgId,
        userId: tenant.userId,
      },
    });

    const queue = getScanQueue();
    await queue.add(
      "run-scan",
      isGitUrl ? { scanId: scan.id, repoUrl: source } : { scanId: scan.id, path: source },
      { jobId: scan.id }
    );

    return { scanId: scan.id, status: scan.status };
  }

  @Post(":id/cancel")
  async cancel(@CurrentTenant() tenant: Tenant, @Param("id") id: string) {
    const scan = await findOrgScan(tenant, id);
    if (scan.status !== "queued" && scan.status !== "active") {
      throw new BadRequestException(`Scan is already ${scan.status}; nothing to cancel.`);
    }

    const queue = getScanQueue();
    const job = await queue.getJob(id);
    if (job) {
      const state = await job.getState();
      // Only waiting/delayed jobs can be removed outright. An active job is
      // mid-run in the worker process -- it cooperatively checks the scan's
      // status between stages and bails out itself (see apps/worker).
      if (state === "waiting" || state === "delayed") {
        await job.remove();
      }
    }

    const updated = await prisma.scan.update({
      where: { id },
      data: { status: "cancelled" },
    });

    return { scanId: updated.id, status: updated.status };
  }

  @Get()
  async list(@CurrentTenant() tenant: Tenant, @Query("limit") limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIST_LIMIT);
    const scans = await prisma.scan.findMany({
      where: { orgId: tenant.orgId },
      orderBy: { createdAt: "desc" },
      take,
    });
    if (scans.length === 0) return [];

    // Per-severity counts let list views show open findings without loading
    // every scan's full issue list.
    const grouped = await prisma.issue.groupBy({
      by: ["scanId", "severity"],
      where: { scanId: { in: scans.map((s) => s.id) } },
      _count: { _all: true },
    });
    const counts = new Map<string, Record<string, number>>();
    for (const row of grouped) {
      const entry = counts.get(row.scanId) ?? { critical: 0, high: 0, medium: 0, low: 0 };
      entry[row.severity] = row._count._all;
      counts.set(row.scanId, entry);
    }
    return scans.map((scan) => ({
      ...scan,
      issueCounts: counts.get(scan.id) ?? { critical: 0, high: 0, medium: 0, low: 0 },
    }));
  }

  @Get(":id")
  async getStatus(@CurrentTenant() tenant: Tenant, @Param("id") id: string) {
    return findOrgScanDetail(tenant, id);
  }

  @Get(":id/report")
  async getReport(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Query("format") formatParam: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const format = (formatParam ?? "markdown") as ReportFormat;
    if (!REPORT_FORMATS.includes(format)) {
      throw new BadRequestException(`Unsupported format '${formatParam}'. Use one of: ${REPORT_FORMATS.join(", ")}`);
    }

    const scan = await findOrgScanDetail(tenant, id);

    // pdf is currently the only format not on every plan; skip the extra
    // Subscription lookup for the common (free-and-included) formats.
    if (format === "pdf") {
      const subscription = await prisma.subscription.findUnique({ where: { orgId: tenant.orgId } });
      const plan = getEffectivePlan(subscription);
      if (!planAllowsFormat(plan, format)) {
        throw new ForbiddenException(`The '${format}' report format requires a Pro or Enterprise plan.`);
      }
    }

    const body = await generateReport(scan, format);

    res.setHeader("Content-Type", REPORT_CONTENT_TYPES[format]);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="readycheck-report-${id}.${REPORT_EXTENSIONS[format]}"`
    );

    return body;
  }
}
