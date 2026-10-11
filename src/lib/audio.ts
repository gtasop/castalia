import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import type { Quality } from "@prisma/client";
import { db } from "./db";
import { putFile } from "./storage";

const run = promisify(execFile);

export type Probe = { durationSec: number; sampleRate: number; bitDepth: number; lossless: boolean };

export async function probe(file: string): Promise<Probe> {
  const { stdout } = await run(ffprobe.path, [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=codec_name,sample_rate,bits_per_raw_sample,bits_per_sample,sample_fmt:format=duration",
    "-of", "json",
    file,
  ]);
  const info = JSON.parse(stdout);
  const s = info.streams?.[0];
  if (!s) throw new Error("No audio stream found");
  const codec: string = s.codec_name;
  const lossless = codec === "flac" || codec.startsWith("pcm_") || codec === "alac" || codec === "wavpack";
  const fmtBits: Record<string, number> = { s16: 16, s16p: 16, s32: 24, s32p: 24, flt: 24, fltp: 24, s24: 24 };
  const bitDepth = Number(s.bits_per_raw_sample) || Number(s.bits_per_sample) || fmtBits[s.sample_fmt] || 16;
  return {
    durationSec: Number(info.format?.duration) || 0,
    sampleRate: Number(s.sample_rate) || 44100,
    bitDepth: Math.min(bitDepth, 24),
    lossless,
  };
}

type Output = { quality: Quality; ext: string; mime: string; args: string[]; bitDepth?: number; sampleRate?: number };

function outputsFor(p: Probe): Output[] {
  const outs: Output[] = [];
  const isHiRes = p.lossless && (p.sampleRate > 48000 || p.bitDepth > 16);
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
async function pcmHash(file: string): Promise<string> {
  const { stdout } = await run(ffmpegPath as string, ["-v", "error", "-i", file, "-map", "0:a:0", "-c:a", "pcm_s32le", "-f", "md5", "-"]);
  return stdout.trim();
}

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
    if (!p.lossless) throw new Error("Please upload a lossless master (FLAC, WAV, AIFF or ALAC).");

    const produced: { out: Output; file: string }[] = [];
    for (const out of outputsFor(p)) {
      const file = path.join(work, `${out.quality.toLowerCase()}.${out.ext}`);
      await run(ffmpegPath as string, ["-y", "-v", "error", "-i", masterFile, "-map", "0:a:0", "-map_metadata", "-1", ...out.args, file], {
        maxBuffer: 1 << 24,
      });
      produced.push({ out, file });
    }

    const masterHash = await pcmHash(masterFile);
    let preserved = false;
    for (const { out, file } of produced) {
      if (out.ext === "flac" && (await pcmHash(file)) === masterHash) {
        preserved = true;
        break;
      }
    }

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
      data: { status: "READY", error: null, durationSec: p.durationSec, masterBitDepth: p.bitDepth, masterSampleRate: p.sampleRate, masterKey },
    });
  } catch (e) {
    await db.track.update({
      where: { id: trackId },
      data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 500) : "Transcoding failed" },
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export function qualityLabel(f: { quality: Quality; bitDepth: number | null; sampleRate: number | null }) {
  if (f.quality === "LOW") return "AAC 256 kbps";
  if (f.quality === "MP3") return "MP3 320 kbps";
  return `FLAC ${f.bitDepth ?? 16}-bit / ${((f.sampleRate ?? 44100) / 1000).toString()} kHz`;
}
