import { Controller, Get } from "@nestjs/common";
import { Public } from "./tenancy/tenant";

@Public()
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok", service: "readycheck-api" };
  }
}
