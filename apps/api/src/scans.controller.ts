import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { getScanQueue } from "@readycheck/queue";
import { getPrismaClient } from "@readycheck/db";

interface TriggerScanDto {
  path: string;
}

const prisma = getPrismaClient();

@Controller("scans")
export class ScansController {
  @Post()
  async trigger(@Body() dto: TriggerScanDto) {
    const scan = await prisma.scan.create({
      data: { path: dto.path, status: "queued" },
    });

    const queue = getScanQueue();
    await queue.add("run-scan", { scanId: scan.id, path: dto.path }, { jobId: scan.id });

    return { scanId: scan.id, status: scan.status };
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
