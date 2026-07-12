import { Module, type Provider } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GitHubStrategy } from "./github.strategy";
import { GoogleStrategy } from "./google.strategy";

// Strategies throw if their provider's client id/secret aren't set, so only
// register the ones that are actually configured. This keeps the API
// bootable in dev/CI without every OAuth app provisioned (mirrors how
// ApiKeyGuard no-ops when READYCHECK_API_KEY is unset).
const strategyProviders: Provider[] = [];
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  strategyProviders.push(GitHubStrategy);
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  strategyProviders.push(GoogleStrategy);
}

// The dev fallback secret is public knowledge (it's in this repo), so a
// production deploy running on it would let anyone forge sessions. Fail the
// boot instead of silently looking secure.
function jwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET must be set in production.");
  }
  return "dev-insecure-secret-change-me";
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: { expiresIn: "30d", algorithm: "HS256" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ...strategyProviders],
  exports: [AuthService],
})
export class AuthModule {}
