import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type Profile } from "passport-github2";
import type { OAuthProfile } from "./auth.service";

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

// The profile's public email carries no verification info, and linking
// accounts by an unverified email is an account-takeover vector (see
// OAuthProfile.email). /user/emails reports the verified flag per address.
async function fetchVerifiedEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "readycheck-api",
      },
    });
    if (!res.ok) return null;

    const emails = (await res.json()) as GitHubEmail[];
    if (!Array.isArray(emails)) return null;

    const primary = emails.find((e) => e.verified && e.primary);
    return primary?.email ?? emails.find((e) => e.verified)?.email ?? null;
  } catch {
    return null;
  }
}

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, "github") {
  constructor() {
    const clientID = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientID || !clientSecret) {
      throw new Error("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set to use GitHub login.");
    }

    super({
      clientID,
      clientSecret,
      callbackURL: `${process.env.API_URL ?? "http://localhost:3001"}/auth/github/callback`,
      scope: ["user:email"],
    });
  }

  async validate(accessToken: string, _refreshToken: string, profile: Profile): Promise<OAuthProfile> {
    return {
      provider: "github",
      providerAccountId: profile.id,
      email: await fetchVerifiedEmail(accessToken),
      name: profile.displayName || profile.username || null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}
