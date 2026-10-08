import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { HealthController } from "./health.controller";
import { NotificationsController } from "./notifications.controller";
import { OrgsController } from "./orgs.controller";
import { ScansController } from "./scans.controller";
import { SessionGuard } from "./tenancy/session.guard";
import { UsersController } from "./users.controller";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 60,
      },
    ]),
    AuthModule,
    BillingModule,
  ],
  controllers: [
    HealthController,
    ScansController,
    UsersController,
    NotificationsController,
    OrgsController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Runs after the throttler, so rejected credentials still count toward
    // the rate limit. Routes opt out with @Public().
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
  ],
})
export class AppModule {}
