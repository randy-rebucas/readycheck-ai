import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { getScanQueue } from "@readycheck/queue";

interface TriggerScanDto {
  path: string;
}

@Controller("scans")
export class ScansController {
  @Post()
  async trigger(@Body() dto: TriggerScanDto) {
    const scanId = randomUUID();
    const queue = getScanQueue();

    await queue.add(
      "run-scan",
      { scanId, path: dto.path },
      { jobId: scanId }
    );

    return { scanId, status: "queued" };
  }

  @Get(":id")
  async getStatus(@Param("id") id: string) {
    const queue = getScanQueue();
    const job = await queue.getJob(id);

    if (!job) {
      throw new NotFoundException(`No scan found with id ${id}`);
    }

    const state = await job.getState();
    const result = job.returnvalue ?? null;

    return {
      scanId: id,
      status: state,
      progress: job.progress,
      result,
    };
  }
}
