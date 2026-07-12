import {
  BadRequestException,
  Body,
  Controller,
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
import { ApiKeyGuard } from "./api-key.guard";
import { resolveScanSource, type TriggerScanDto } from "./scan-source";

const REPORT_FORMATS: ReportFormat[] = ["json", "markdown", "csv", "html"];
const REPORT_EXTENSIONS: Record<ReportFormat, string> = {
  json: "json",
  markdown: "md",
  csv: "csv",
  html: "html",
};

const prisma = getPrismaClient();

@Controller("scans")
@UseGuards(ApiKeyGuard)
export class ScansController {
  // Scan triggering is the expensive/abusable action (spawns a clone + full
  // pipeline run), so it gets a tighter limit than the controller-wide default.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async trigger(@Body() dto: TriggerScanDto) {
    const resolved = resolveScanSource(dto);
    if (!resolved) {
      throw new BadRequestException("Provide either 'path' or 'repoUrl'.");
    }
    const { source, isGitUrl } = resolved;

    const scan = await prisma.scan.create({
      data: {
        path: source,
        sourceType: isGitUrl ? "git" : "local",
        status: "queued",
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
  async cancel(@Param("id") id: string) {
    const scan = await prisma.scan.findUnique({ where: { id } });
    if (!scan) {
      throw new NotFoundException(`No scan found with id ${id}`);
    }
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
  async list(@Query("limit") limit?: string) {
    return prisma.scan.findMany({
      orderBy: { createdAt: "desc" },
      take: limit ? Number(limit) : 20,
    });
  }

  @Get(":id")
  async getStatus(@Param("id") id: string) {
    const scan = await prisma.scan.findUnique({
      where: { id },
      include: { issues: true, categoryScores: true },
    });

    if (!scan) {
      throw new NotFoundException(`No scan found with id ${id}`);
    }

    return scan;
  }

  @Get(":id/report")
  async getReport(
    @Param("id") id: string,
    @Query("format") formatParam: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const format = (formatParam ?? "markdown") as ReportFormat;
    if (!REPORT_FORMATS.includes(format)) {
      throw new BadRequestException(`Unsupported format '${formatParam}'. Use one of: ${REPORT_FORMATS.join(", ")}`);
    }

    const scan = await prisma.scan.findUnique({
      where: { id },
      include: { issues: true, categoryScores: true },
    });

    if (!scan) {
      throw new NotFoundException(`No scan found with id ${id}`);
    }

    const body = generateReport(scan, format);

    res.setHeader("Content-Type", REPORT_CONTENT_TYPES[format]);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="readycheck-report-${id}.${REPORT_EXTENSIONS[format]}"`
    );

    return body;
  }
}
