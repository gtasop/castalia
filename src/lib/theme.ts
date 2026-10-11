import "server-only";
import type { Theme } from "@prisma/client";
import { cookies } from "next/headers";

// Light/dark preference. Logged-in users keep it on their account; everyone
// also gets a cookie so the right theme renders on the first paint, and so
// it works for visitors who are not logged in.

export const THEMES = ["system", "light", "dark"] as const;
export type ThemePref = (typeof THEMES)[number];
export const THEME_COOKIE = "castalia_theme";

export const THEME_LABEL: Record<ThemePref, string> = { system: "System", light: "Light", dark: "Dark" };

export function isTheme(v: unknown): v is ThemePref {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

export const toThemePref = (t: Theme): ThemePref => t.toLowerCase() as ThemePref;
export const toThemeEnum = (t: ThemePref): Theme => t.toUpperCase() as Theme;

/** The account's choice when logged in, otherwise the cookie. */
export async function themePreference(user: { theme: Theme } | null): Promise<ThemePref> {
  if (user) return toThemePref(user.theme);
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(v) ? v : "system";
}

export async function setThemeCookie(theme: ThemePref) {
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

/** The header toggle cycles system → light → dark. */
export function nextTheme(t: ThemePref): ThemePref {
  return THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
}
