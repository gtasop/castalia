// Cleaning for user-entered text. Keeps every script, emoji and the
// joiners real text needs (ZWJ for emoji sequences, ZWNJ for Persian), and
// removes what only causes trouble: NUL and other control characters,
// bidirectional overrides used for spoofing, and invisible formatting.

// C0/C1 controls except tab/newline (handled separately), plus DEL.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Bidi embeddings/overrides/isolates, zero-width space, word joiner, BOM.
const INVISIBLE = /[‪-‮⁦-⁩​⁠﻿]/g;

/** Single-line text: newlines and tabs become spaces. */
export function cleanLine(value: unknown, maxChars: number): string {
  const s = String(value ?? "")
    .normalize("NFC")
    .replace(/[\t\r\n]+/g, " ")
    .replace(CONTROL, "")
    .replace(INVISIBLE, "")
    .trim();
  return sliceChars(s, maxChars);
}

/** Multi-line text (descriptions, bios): keeps newlines, max 2 blank lines. */
export function cleanBlock(value: unknown, maxChars: number): string {
  const s = String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(CONTROL, "")
    .replace(INVISIBLE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return sliceChars(s, maxChars);
}

/** Number of user-perceived characters. */
export function charCount(s: string): number {
  return [...segmenter().segment(s)].length;
}

/** Cut to at most `max` user-perceived characters, never splitting one. */
export function sliceChars(s: string, max: number): string {
  if (s.length <= max) return s;
  let out = "";
  let n = 0;
  for (const { segment } of segmenter().segment(s)) {
    if (++n > max) break;
    out += segment;
  }
  return out;
}

/** First visible character (letter, digit or emoji) of a string, or "". */
export function firstGrapheme(s: string): string {
  for (const { segment } of segmenter().segment(s)) {
    if (/[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(segment)) return segment;
  }
  return "";
}

let seg: Intl.Segmenter | null = null;
function segmenter() {
  seg ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return seg;
}
