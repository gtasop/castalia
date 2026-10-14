// What a form action returns instead of redirecting:
// - on failure, the message and what the person typed, so the form can be
//   shown again with their input;
// - on success (for edits that should stay in place), a short confirmation.
// Shared by server and browser.
export type FormState = { error?: string; success?: string; values: Record<string, string | string[]> } | null;
