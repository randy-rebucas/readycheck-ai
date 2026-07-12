import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type Profile, type VerifyCallback } from "passport-google-oauth20";
import type { OAuthProfile } from "./auth.service";

// Only accept the email if Google asserted it's verified -- linking accounts
// by an unverified email is an account-takeover vector (see OAuthProfile.email).
function verifiedEmail(profile: Profile): string | null {
  const email = profile.emails?.[0]?.value ?? null;
  if (!email) return null;

  const json = profile._json as { email_verified?: boolean | string } | undefined;
  const verified = json?.email_verified === true || json?.email_verified === "true";
  return verified ? email : null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientID || !clientSecret) {
      throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set to use Google login.");
    }

    super({
      clientID,
      clientSecret,
      callbackURL: `${process.env.API_URL ?? "http://localhost:3001"}/auth/google/callback`,
      scope: ["profile", "email"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): void {
    const oauthProfile: OAuthProfile = {
      provider: "google",
      providerAccountId: profile.id,
      email: verifiedEmail(profile),
      name: profile.displayName ?? null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    done(null, oauthProfile);
  }
}
