import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService, type OAuthProfile } from "./auth.service";
import {
  parseForgotPasswordInput,
  parseLoginInput,
  parseRegisterInput,
  parseResetPasswordInput,
} from "./credentials";
import { decodeRedirectState } from "./oauth-state";
import { GitHubAuthGuard, GoogleAuthGuard } from "./provider.guards";
import { Public } from "../tenancy/tenant";

// Public: these routes establish identity (or, for /auth/me, verify the
// token themselves), so SessionGuard can't apply.
@Public()
@Controller("auth")
export class AuthController {
  // Explicit token: the dev runner (tsx/esbuild) doesn't emit decorator
  // metadata, so type-based constructor injection resolves to undefined.
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  // Credential endpoints get a tight limit: they're the online
  // password-guessing surface.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("register")
  async register(@Body() body: unknown) {
    const input = parseRegisterInput(body);
    if (!input.ok) throw new BadRequestException(input.error);

    const user = await this.auth.registerWithPassword(input.value);
    return { token: this.auth.signTransferToken(user) };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  async login(@Body() body: unknown) {
    const input = parseLoginInput(body);
    if (!input.ok) throw new BadRequestException(input.error);

    const user = await this.auth.loginWithPassword(input.value.email, input.value.password);
    if (!user) throw new UnauthorizedException("Invalid email or password.");

    return { token: this.auth.signTransferToken(user) };
  }

  // Extra-tight limit: each request can send an email.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  forgotPassword(@Body() body: unknown) {
    const input = parseForgotPasswordInput(body);
    if (!input.ok) throw new BadRequestException(input.error);

    // Respond before doing the lookup/email work so neither the response
    // body nor its timing reveals whether the account exists.
    void this.auth.requestPasswordReset(input.value.email).catch((err) => {
      console.error("[auth] password reset request failed:", err);
    });

    return { ok: true };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("reset-password")
  async resetPassword(@Body() body: unknown) {
    const input = parseResetPasswordInput(body);
    if (!input.ok) throw new BadRequestException(input.error);

    const user = await this.auth.resetPassword(input.value.token, input.value.password);
    if (!user) {
      throw new BadRequestException(
        "This reset link is invalid or has expired. Request a new one."
      );
    }

    return { token: this.auth.signTransferToken(user) };
  }

  @Get("github")
  @UseGuards(GitHubAuthGuard)
  githubLogin() {
    // GitHubAuthGuard redirects to GitHub; this handler body never runs.
  }

  @Get("github/callback")
  @UseGuards(GitHubAuthGuard)
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    await this.completeLogin(req, res);
  }

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // GoogleAuthGuard redirects to Google; this handler body never runs.
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    await this.completeLogin(req, res);
  }

  @Get("me")
  async me(@Req() req: Request) {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    const user = token ? this.auth.verifySession(token) : null;

    if (!user) {
      throw new UnauthorizedException("Invalid or missing session token.");
    }

    return user;
  }

  private async completeLogin(req: Request, res: Response) {
    const profile = req.user as OAuthProfile;
    const user = await this.auth.findOrCreateUser(profile);

    // The token in this redirect URL ends up in browser history and server
    // logs, so it's a 60s single-purpose transfer token, not the session.
    // The dashboard's callback exchanges it for the real session cookie.
    const token = this.auth.signTransferToken(user);

    const redirectUri = decodeRedirectState(
      typeof req.query.state === "string" ? req.query.state : undefined
    );
    const url = new URL(redirectUri);
    url.searchParams.set("token", token);
    res.redirect(url.toString());
  }
}
