import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { HealthController } from "./health.controller";
import { NotificationsController } from "./notifications.controller";
import { ScansController } from "./scans.controller";
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
  controllers: [HealthController, ScansController, UsersController, NotificationsController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
