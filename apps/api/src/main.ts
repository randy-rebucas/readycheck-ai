import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getPrismaClient } from "@readycheck/db";
import { getScanQueue } from "@readycheck/queue";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`ReadyCheck API listening on http://localhost:${port}`);

  let shuttingDown = false;

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[api] received ${signal}, shutting down...`);
    try {
      await app.close();
      await getScanQueue().close();
      await getPrismaClient().$disconnect();
      console.log("[api] shutdown complete");
      process.exit(0);
    } catch (err) {
      console.error("[api] error during shutdown:", err);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap();
