import { cookies } from "next/headers";
import { MODE_COOKIE, parseMode, type ExperienceMode } from "./mode";

export async function getMode(): Promise<ExperienceMode> {
  return parseMode((await cookies()).get(MODE_COOKIE)?.value);
}
