// Shared by server and browser code.

/** A play is counted (for artists' listening statistics) after this many seconds. */
export const MIN_PLAY_SECONDS = 30;

export const DOWNLOAD_FORMATS = {
  hires: { quality: ["HIRES", "LOSSLESS"], ext: "flac", label: "FLAC Hi-Res" },
  flac: { quality: ["LOSSLESS"], ext: "flac", label: "FLAC 16-bit" },
  mp3: { quality: ["MP3"], ext: "mp3", label: "MP3 320" },
} as const;

export type DownloadFormat = keyof typeof DOWNLOAD_FORMATS;

export function isDownloadFormat(v: string | null): v is DownloadFormat {
  return v !== null && Object.hasOwn(DOWNLOAD_FORMATS, v);
}

export function downloadFormat(v: string | null) {
  return isDownloadFormat(v) ? DOWNLOAD_FORMATS[v] : DOWNLOAD_FORMATS.flac;
}
