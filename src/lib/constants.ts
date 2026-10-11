// Shared by server and browser code.

/** A play counts towards payouts after this many seconds of listening. */
export const MIN_PLAY_SECONDS = 30;

export const DOWNLOAD_FORMATS = {
  hires: { quality: ["HIRES", "LOSSLESS"], ext: "flac", label: "FLAC Hi-Res" },
  flac: { quality: ["LOSSLESS"], ext: "flac", label: "FLAC 16-bit" },
  mp3: { quality: ["MP3"], ext: "mp3", label: "MP3 320" },
} as const;

export type DownloadFormat = keyof typeof DOWNLOAD_FORMATS;

export function downloadFormat(v: string | null) {
  return DOWNLOAD_FORMATS[(v ?? "flac") as DownloadFormat] ?? DOWNLOAD_FORMATS.flac;
}
