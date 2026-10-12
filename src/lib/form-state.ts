// What a form action returns when it can't proceed: the message to show and
// what the person typed, so the form can be shown again with their input.
// (On success the action redirects instead.) Shared by server and browser.
export type FormState = { error: string; values: Record<string, string | string[]> } | null;
