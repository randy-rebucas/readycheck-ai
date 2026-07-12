import { ExecutionContext, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { encodeRedirectState } from "./oauth-state";

function redirectUriFrom(context: ExecutionContext): string | undefined {
  const req = context.switchToHttp().getRequest<Request>();
  const value = req.query.redirect_uri;
  return typeof value === "string" ? value : undefined;
}

@Injectable()
export class GitHubAuthGuard extends AuthGuard("github") {
  canActivate(context: ExecutionContext) {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      throw new ServiceUnavailableException(
        "GitHub login is not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET missing)."
      );
    }
    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return { state: encodeRedirectState(redirectUriFrom(context)) };
  }
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  canActivate(context: ExecutionContext) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new ServiceUnavailableException(
        "Google login is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing)."
      );
    }
    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return { state: encodeRedirectState(redirectUriFrom(context)) };
  }
}
