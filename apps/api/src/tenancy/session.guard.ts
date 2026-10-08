import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "../auth/auth.service";
import { resolveTenant } from "./orgs";
import { IS_PUBLIC_KEY, type TenantRequest } from "./tenant";

export const ORG_HEADER = "x-org-id";

/**
 * Global guard: every route not marked @Public() needs a valid session token
 * (`Authorization: Bearer <session JWT>`, the dashboard's own cookie value).
 * Identity comes only from that token -- never from a userId in the URL or
 * body -- and the optional x-org-id header is honored only for orgs the user
 * belongs to.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  // Explicit tokens: the dev runner (tsx/esbuild) doesn't emit decorator
  // metadata, so type-based constructor injection resolves to undefined.
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<TenantRequest>();
    const header = request.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    const user = token ? this.auth.verifySession(token) : null;
    if (!user) throw new UnauthorizedException("Invalid or missing session token.");

    const requestedOrgId = request.header(ORG_HEADER)?.trim() || undefined;
    const resolution = await resolveTenant(user.id, requestedOrgId);
    if (!resolution.ok) {
      if (resolution.reason === "unknown_user") {
        throw new UnauthorizedException("Session refers to a user that no longer exists.");
      }
      throw new ForbiddenException("You are not a member of this organization.");
    }

    request.tenant = resolution.tenant;
    return true;
  }
}
