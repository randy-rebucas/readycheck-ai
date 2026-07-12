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
import { getScanQueue } from "@readycheck/queue";
import { getPrismaClient } from "@readycheck/db";
import { generateReport, REPORT_CONTENT_TYPES, type ReportFormat } from "@readycheck/reports";
import { ApiKeyGuard } from "./api-key.guard";

const REPORT_FORMATS: ReportFormat[] = ["json", "markdown", "csv", "html"];
const REPORT_EXTENSIONS: Record<ReportFormat, string> = {
  json: "json",
  markdown: "md",
  csv: "csv",
  html: "html",
};

interface TriggerScanDto {
  path?: string;
  repoUrl?: string;
}

const prisma = getPrismaClient();
const GIT_URL_PATTERN = /^(https?:\/\/|git@)\S+\.git$|^https?:\/\/(github|gitlab|bitbucket)\.com\/\S+$/i;

@Controller("scans")
@UseGuards(ApiKeyGuard)
export class ScansController {
  @Post()
  async trigger(@Body() dto: TriggerScanDto) {
    const path = dto.path?.trim();
    const repoUrl = dto.repoUrl?.trim();

    if (!path && !repoUrl) {
      throw new BadRequestException("Provide either 'path' or 'repoUrl'.");
    }

    const isGitUrl = Boolean(repoUrl) || (path ? GIT_URL_PATTERN.test(path) : false);
    const source = repoUrl ?? path!;

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
