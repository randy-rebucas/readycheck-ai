import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { ScansController } from "./scans.controller";

@Module({
  controllers: [HealthController, ScansController],
})
export class AppModule {}
