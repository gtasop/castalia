// The sign-in attempt, kept while the browser is on Google's page.
export const GOOGLE_FLOW_COOKIE = "castalia_google";
// A verified Google profile waiting for the person to finish signing up.
export const GOOGLE_SIGNUP_COOKIE = "castalia_google_signup";
export const GOOGLE_SIGNUP_PURPOSE = "google-signup";

export type PendingGoogleSignup = { sub: string; email: string; name: string; next: string };
