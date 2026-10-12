import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import type { Quality } from "@prisma/client";
import { db } from "./db";
import { deletePrefix, putFile } from "./storage";

const run = promisify(execFile);

// Uploads are untrusted. ffmpeg only reads local files (no network or
// playlist protocols) and only these containers and codecs are accepted.
const CONTAINERS: Record<string, string> = {
  flac: "flac",
  wav: "wav",
  w64: "w64",
  aiff: "aiff",
  wv: "wv",
  "mov,mp4,m4a,3gp,3g2,mj2": "mov", // ALAC in .m4a
};
const LOSSLESS_CODECS = new Set([
  "flac", "alac", "wavpack",
  "pcm_s16le", "pcm_s16be", "pcm_s24le", "pcm_s24be", "pcm_s32le", "pcm_s32be",
  "pcm_f32le", "pcm_f32be", "pcm_f64le", "pcm_f64be",
]);
const SAFE_INPUT = ["-protocol_whitelist", "file"];

/** An error whose message is meant for the artist. */
export class UploadError extends Error {}

export type Probe = { durationSec: number; sampleRate: number; bitDepth: number; codec: string; demuxer: string };

export async function probe(file: string): Promise<Probe> {
  let stdout: string;
  try {
    ({ stdout } = await run(ffprobe.path, [
      "-v", "error", ...SAFE_INPUT,
      "-format_whitelist", "flac,wav,w64,aiff,wv,mov",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_name,sample_rate,bits_per_raw_sample,bits_per_sample,sample_fmt:format=duration,format_name",
      "-of", "json",
      file,
    ]));
  } catch {
    throw new UploadError("We couldn't read this file. Upload a FLAC, WAV, AIFF or ALAC file.");
  }
  const info = JSON.parse(stdout);
  const s = info.streams?.[0];
  const demuxer = CONTAINERS[info.format?.format_name];
  if (!s || !demuxer) throw new UploadError("We couldn't find audio in this file. Upload a FLAC, WAV, AIFF or ALAC file.");
  if (!LOSSLESS_CODECS.has(s.codec_name)) {
    throw new UploadError("This file isn't lossless (or uses a low-quality format like mu-law). Upload the lossless master: FLAC, WAV, AIFF or ALAC.");
  }
  const fmtBits: Record<string, number> = { s16: 16, s16p: 16, s32: 24, s32p: 24, flt: 24, fltp: 24, s24: 24 };
  const bitDepth = Number(s.bits_per_raw_sample) || Number(s.bits_per_sample) || fmtBits[s.sample_fmt] || 16;
  return {
    durationSec: Number(info.format?.duration) || 0,
    sampleRate: Number(s.sample_rate) || 44100,
    bitDepth: Math.min(bitDepth, 24),
    codec: s.codec_name,
    demuxer,
  };
}

/** Duration of audio that actually decodes (catches truncated files). */
async function decodedDuration(file: string): Promise<number> {
  const { stdout } = await run(ffprobe.path, ["-v", "error", ...SAFE_INPUT, "-f", "flac", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(stdout.trim()) || 0;
}

type Output = { quality: Quality; ext: string; mime: string; args: string[]; bitDepth?: number; sampleRate?: number };

function outputsFor(p: Probe): Output[] {
  const outs: Output[] = [];
  const isHiRes = p.sampleRate > 48000 || p.bitDepth > 16;
  if (isHiRes) {
    const sr = Math.min(p.sampleRate, 192000);
    const bits = p.bitDepth > 16 ? 24 : 16;
    outs.push({
      quality: "HIRES", ext: "flac", mime: "audio/flac", bitDepth: bits, sampleRate: sr,
      args: ["-c:a", "flac", "-compression_level", "8", "-ar", String(sr), "-sample_fmt", bits === 24 ? "s32" : "s16", "-bits_per_raw_sample", String(bits)],
    });
  }
  outs.push(
    {
      quality: "LOSSLESS", ext: "flac", mime: "audio/flac", bitDepth: 16, sampleRate: 44100,
      // Long-filter resampling and triangular dither down to 16 bit.
      args: ["-af", "aresample=44100:filter_size=64:phase_shift=10:cutoff=0.97:dither_method=triangular", "-c:a", "flac", "-compression_level", "8", "-ar", "44100", "-sample_fmt", "s16"],
    },
    { quality: "LOW", ext: "m4a", mime: "audio/mp4", args: ["-c:a", "aac", "-b:a", "256k", "-ar", "44100", "-movflags", "+faststart"] },
    { quality: "MP3", ext: "mp3", mime: "audio/mpeg", args: ["-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"] },
  );
  return outs;
}

/** MD5 of the decoded audio samples, so files in different containers compare equal. */
async function pcmHash(file: string, demuxer: string): Promise<string> {
  const { stdout } = await run(ffmpegPath as string, ["-v", "error", ...SAFE_INPUT, "-f", demuxer, "-i", file, "-map", "0:a:0", "-c:a", "pcm_s32le", "-f", "md5", "-"]);
  return stdout.trim();
}

const trackExists = async (trackId: string) => !!(await db.track.findUnique({ where: { id: trackId }, select: { id: true } }));

/**
 * Transcodes an uploaded master into every streaming/download format and
 * stores the results. Updates the track row with status and metadata.
 *
 * The master itself is only stored when none of the FLAC outputs decodes to
 * exactly the same samples. For most uploads (16/44.1, or hi-res up to
 * 24/192) a FLAC output is a bit-perfect copy, and keeping the master as
 * well would add ~40% to the album's storage.
 */
export async function processTrack(trackId: string, masterFile: string) {
  const work = await mkdtemp(path.join(os.tmpdir(), "castalia-"));
  try {
    const p = await probe(masterFile);
    const input = [...SAFE_INPUT, "-f", p.demuxer, "-i", masterFile];

    const produced: { out: Output; file: string }[] = [];
    for (const out of outputsFor(p)) {
      const file = path.join(work, `${out.quality.toLowerCase()}.${out.ext}`);
      await run(ffmpegPath as string, ["-y", "-v", "error", ...input, "-map", "0:a:0", "-map_metadata", "-1", ...out.args, file], {
        maxBuffer: 1 << 24,
      });
      produced.push({ out, file });
    }

    // A truncated or corrupt file can claim a length in its header that the
    // audio doesn't have. Trust what actually decoded.
    const lossless = produced.find((x) => x.out.quality === "LOSSLESS")!;
    const durationSec = await decodedDuration(lossless.file);
    if (durationSec < 0.5) throw new UploadError("This file contains no playable audio.");
    if (p.durationSec > 0 && Math.abs(p.durationSec - durationSec) > Math.max(1, p.durationSec * 0.02)) {
      throw new UploadError(
        `This file looks damaged or incomplete: it says it is ${Math.round(p.durationSec)} s long, but only ${Math.round(durationSec)} s of audio could be read. Upload it again.`,
      );
    }

    const masterHash = await pcmHash(masterFile, p.demuxer);
    let preserved = false;
    for (const { out, file } of produced) {
      if (out.ext === "flac" && (await pcmHash(file, "flac")) === masterHash) {
        preserved = true;
        break;
      }
    }

    // The artist may have deleted the track while it was converting.
    if (!(await trackExists(trackId))) return;

    for (const { out, file } of produced) {
      const key = `tracks/${trackId}/${path.basename(file)}`;
      await putFile(key, file, out.mime);
      const { size } = await stat(file);
      const data = { key, mime: out.mime, bytes: size, bitDepth: out.bitDepth ?? null, sampleRate: out.sampleRate ?? null };
      await db.trackFile.upsert({
        where: { trackId_quality: { trackId, quality: out.quality } },
        create: { trackId, quality: out.quality, ...data },
        update: data,
      });
    }

    let masterKey: string | null = null;
    if (!preserved) {
      masterKey = `tracks/${trackId}/master${path.extname(masterFile).toLowerCase()}`;
      await putFile(masterKey, masterFile, "application/octet-stream");
    }

    await db.track.update({
      where: { id: trackId },
      data: { status: "READY", error: null, durationSec, masterBitDepth: p.bitDepth, masterSampleRate: p.sampleRate, masterKey },
    });
  } catch (e) {
    const message = e instanceof UploadError ? e.message : "Converting this file failed. Try uploading it again, or as FLAC or WAV.";
    if (!(e instanceof UploadError)) console.error(`processTrack ${trackId} failed`, e);
    await db.track.updateMany({ where: { id: trackId }, data: { status: "FAILED", error: message } });
  } finally {
    await rm(work, { recursive: true, force: true });
    // Nothing should be left behind for a track deleted mid-conversion.
    if (!(await trackExists(trackId).catch(() => true))) await deletePrefix(`tracks/${trackId}/`).catch(() => {});
  }
}

export function qualityLabel(f: { quality: Quality; bitDepth: number | null; sampleRate: number | null }) {
  if (f.quality === "LOW") return "AAC 256 kbps";
  if (f.quality === "MP3") return "MP3 320 kbps";
  return `FLAC ${f.bitDepth ?? 16}-bit / ${((f.sampleRate ?? 44100) / 1000).toString()} kHz`;
}
