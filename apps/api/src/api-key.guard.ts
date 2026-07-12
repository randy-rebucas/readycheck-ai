import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.READYCHECK_API_KEY;

    // No key configured -> auth is disabled (local/dev convenience). Production
    // deployments must set READYCHECK_API_KEY for this guard to do anything.
    if (!expectedKey) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header("x-api-key");

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException("Missing or invalid API key.");
    }

    return true;
  }
}
