import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { getScanQueue } from "@readycheck/queue";
import { getPrismaClient } from "@readycheck/db";

interface TriggerScanDto {
  path?: string;
  repoUrl?: string;
}

const prisma = getPrismaClient();
const GIT_URL_PATTERN = /^(https?:\/\/|git@)\S+\.git$|^https?:\/\/(github|gitlab|bitbucket)\.com\/\S+$/i;

@Controller("scans")
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
}
