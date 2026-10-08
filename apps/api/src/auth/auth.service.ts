import { createHash, randomBytes } from "node:crypto";
import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { getPrismaClient } from "@readycheck/db";
import bcrypt from "bcryptjs";
import { createPersonalOrg } from "../tenancy/orgs";
import type { RegisterInput } from "./credentials";
import type { JwtPayload, SessionUser, TokenPurpose } from "./jwt.types";
import { sendPasswordResetEmail } from "./mailer";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface OAuthProfile {
  provider: "github" | "google";
  providerAccountId: string;
  /**
   * MUST be null unless the provider asserted this email is verified.
   * findOrCreateUser links accounts across providers by email, so an
   * unverified address here would let an attacker pre-claim someone
   * else's email and take over their account.
   */
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

const prisma = getPrismaClient();

@Injectable()
export class AuthService {
  // Explicit token: the dev runner (tsx/esbuild) doesn't emit decorator
  // metadata, so type-based constructor injection resolves to undefined.
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  async findOrCreateUser(profile: OAuthProfile): Promise<SessionUser> {
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return this.toSessionUser(existingAccount.userId, existingAccount.user);
    }

    // Link by email if the user already signed in another way -- but only to
    // users whose stored email was itself verified (emailVerified). Both
    // sides must be trusted: profile.email is null unless provider-verified
    // (see OAuthProfile), and a credentials signup never proves ownership of
    // its address, so linking to one would hand this OAuth identity to
    // whoever registered the email first.
    const existingUser = profile.email
      ? await prisma.user.findUnique({ where: { email: profile.email } })
      : null;
    const linkableUser = existingUser?.emailVerified ? existingUser : null;

    const user =
      linkableUser ??
      (await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            // If an unverified account squats this address, create without an
            // email rather than fail on the unique constraint.
            email: existingUser ? null : profile.email,
            emailVerified: !existingUser && profile.email !== null,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
          },
        });
        await createPersonalOrg(tx, created);
        return created;
      }));

    await prisma.account.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    });

    return this.toSessionUser(user.id, user);
  }

  async registerWithPassword(input: RegisterInput): Promise<SessionUser> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException(
        "An account with this email already exists. Try signing in, or continue with GitHub/Google."
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          emailVerified: false,
          passwordHash,
          name: input.name,
        },
      });
      await createPersonalOrg(tx, created);
      return created;
    });

    return this.toSessionUser(user.id, user);
  }

  async loginWithPassword(email: string, password: string): Promise<SessionUser | null> {
    const user = await prisma.user.findUnique({ where: { email } });

    // OAuth-only users (passwordHash null) fall through to the same generic
    // failure as unknown emails -- don't reveal which accounts exist.
    if (!user?.passwordHash) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? this.toSessionUser(user.id, user) : null;
  }

  /**
   * Fire-and-forget from the controller's perspective: the endpoint responds
   * identically whether or not the email matches an account, and the actual
   * token + email work happens after the response so timing doesn't leak
   * account existence either.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = randomBytes(32).toString("base64url");

    // Last request wins -- older outstanding links stop working.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3000";
    const resetUrl = `${dashboardUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<SessionUser | null> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) return null;

    const user = await prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
        // Completing a reset via a link sent to this address proves the user
        // controls it -- upgrade credentials-signup emails to verified.
        emailVerified: true,
      },
    });
    await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } });

    return this.toSessionUser(user.id, user);
  }

  private toSessionUser(
    id: string,
    user: { email: string | null; name: string | null; avatarUrl: string | null }
  ): SessionUser {
    return { id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  }

  private sign(
    user: SessionUser,
    purpose: TokenPurpose,
    expiresIn: JwtSignOptions["expiresIn"]
  ): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      purpose,
    };
    return this.jwt.sign(payload, { expiresIn });
  }

  signSession(user: SessionUser): string {
    return this.sign(user, "session", "30d");
  }

  /**
   * Short-lived token carried in the OAuth callback redirect URL. URLs leak
   * (history, logs, proxies), so this must never be a long-lived session --
   * the dashboard's /api/auth/callback exchanges it for the real cookie.
   */
  signTransferToken(user: SessionUser): string {
    return this.sign(user, "transfer", "60s");
  }

  verifySession(token: string): SessionUser | null {
    return this.verify(token, "session");
  }

  private verify(token: string, purpose: TokenPurpose): SessionUser | null {
    try {
      const payload = this.jwt.verify<JwtPayload>(token, { algorithms: ["HS256"] });
      if (payload.purpose !== purpose) return null;
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        avatarUrl: payload.avatarUrl,
      };
    } catch {
      return null;
    }
  }
}
