"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MIN_PLAY_SECONDS } from "@/lib/constants";
import { PLAYER_EVENT, PREVIEW_EVENT } from "./preview";

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string;
  albumId: string;
  durationSec: number;
  /** e.g. "24-bit / 96 kHz", null when only CD quality exists */
  hiRes: string | null;
};

export type QualityPref = "HIRES" | "LOSSLESS" | "LOW";
const QUALITY_LABEL: Record<QualityPref, string> = { HIRES: "Hi-Res", LOSSLESS: "Lossless", LOW: "Data saver" };

type Ctx = {
  current: PlayerTrack | null;
  playing: boolean;
  play: (queue: PlayerTrack[], index: number) => void;
  toggle: () => void;
};

const PlayerContext = createContext<Ctx | null>(null);
export const usePlayer = () => useContext(PlayerContext)!;

function readPref(): QualityPref {
  try {
    const v = localStorage.getItem("castalia.quality");
    if (v === "HIRES" || v === "LOSSLESS" || v === "LOW") return v;
  } catch {}
  return "HIRES";
}

function fmtTime(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<QualityPref>("HIRES");
  const [error, setError] = useState<string | null>(null);
  const [counted, setCounted] = useState(false);

  // Seconds actually listened in this playthrough. Seeking does not add time.
  const listened = useRef(0);
  const lastPos = useRef(0);
  const reported = useRef(false);

  const current = queue[index] ?? null;

  useEffect(() => setQuality(readPref()), []);

  // A preview starting pauses the main player.
  useEffect(() => {
    const pause = () => audio.current?.pause();
    window.addEventListener(PREVIEW_EVENT, pause);
    return () => window.removeEventListener(PREVIEW_EVENT, pause);
  }, []);

  const load = useCallback((track: PlayerTrack, q: QualityPref, resumeAt = 0) => {
    const el = audio.current;
    if (!el) return;
    setError(null);
    el.src = `/api/stream/${track.id}?q=${q}`;
    el.currentTime = resumeAt;
    lastPos.current = resumeAt;
    el.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (!current) return;
    listened.current = 0;
    reported.current = false;
    setCounted(false);
    load(current, readPref());
  }, [current, load]);

  const play = useCallback((q: PlayerTrack[], i: number) => {
    setQueue(q);
    setIndex(i);
  }, []);

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el || !el.src) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  function changeQuality(q: QualityPref) {
    setQuality(q);
    try {
      localStorage.setItem("castalia.quality", q);
    } catch {}
    if (current && audio.current) {
      const at = audio.current.currentTime;
      const wasPlaying = !audio.current.paused;
      load(current, q, at);
      if (!wasPlaying) audio.current.pause();
    }
  }

  function onTimeUpdate() {
    const el = audio.current!;
    const pos = el.currentTime;
    const delta = pos - lastPos.current;
    if (delta > 0 && delta < 1.5) listened.current += delta;
    lastPos.current = pos;
    setTime(pos);

    const needed = Math.min(MIN_PLAY_SECONDS, Math.floor(current?.durationSec ?? MIN_PLAY_SECONDS));
    if (current && !reported.current && listened.current >= needed) {
      reported.current = true;
      fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: current.id, listenedSec: listened.current }),
      })
        .then((r) => r.json())
        .then((r) => setCounted(!!r.counted))
        .catch(() => {});
    }
  }

  function next(step: number) {
    const i = index + step;
    if (i >= 0 && i < queue.length) setIndex(i);
  }

  const activeQuality: QualityPref = quality === "HIRES" && !current?.hiRes ? "LOSSLESS" : quality;
  const formatNote =
    activeQuality === "HIRES" ? `FLAC ${current?.hiRes}` : activeQuality === "LOSSLESS" ? "FLAC 16-bit / 44.1 kHz" : "AAC 256 kbps";

  return (
    <PlayerContext.Provider value={{ current, playing, play, toggle }}>
      {children}
      <audio
        ref={audio}
        preload="auto"
        onPlay={() => {
          setPlaying(true);
          window.dispatchEvent(new Event(PLAYER_EVENT));
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => next(1)}
        onError={() => setError("Subscribe or buy this album to listen.")}
      />
      {current && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-[var(--bar-edge)] bg-bar text-bar-fg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="flex items-center gap-1">
              <button aria-label="Previous" className="p-2 hover:text-accent disabled:opacity-30 disabled:hover:text-bar-fg" disabled={index === 0} onClick={() => next(-1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM9.5 12 18 18V6z" /></svg>
              </button>
              <button aria-label={playing ? "Pause" : "Play"} className="border-2 border-bar-fg bg-accent p-2 text-accent-fg active:translate-x-px active:translate-y-px" onClick={toggle}>
                {playing ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              <button aria-label="Next" className="p-2 hover:text-accent disabled:opacity-30 disabled:hover:text-bar-fg" disabled={index >= queue.length - 1} onClick={() => next(1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" /></svg>
              </button>
            </div>
            <div className="order-first min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-48">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">
                  <span className="font-mono font-bold">{current.title}</span> <span className="text-bar-muted">· {current.artist}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-bar-muted">
                  {fmtTime(time)} / {fmtTime(duration || current.durationSec)}
                </span>
              </div>
              <input
                type="range"
                aria-label="Seek"
                className="mt-1 w-full accent-[var(--accent)]"
                min={0}
                max={duration || current.durationSec || 0}
                step={0.1}
                value={time}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  if (audio.current) audio.current.currentTime = t;
                  lastPos.current = t;
                }}
              />
              <div className="flex justify-between font-mono text-[11px] text-bar-muted">
                <span className="truncate">{error ?? formatNote}</span>
                <span className={`shrink-0 pl-3 ${counted ? "text-accent" : ""}`}>{counted ? "play counted ✓" : `counts after ${MIN_PLAY_SECONDS}s`}</span>
              </div>
            </div>
            <select
              aria-label="Audio quality"
              className="ml-auto border-2 border-bar-fg bg-bar px-2 py-1.5 font-mono text-xs text-bar-fg sm:ml-0"
              value={quality}
              onChange={(e) => changeQuality(e.target.value as QualityPref)}
            >
              {(Object.keys(QUALITY_LABEL) as QualityPref[]).map((q) => (
                <option key={q} value={q}>
                  {QUALITY_LABEL[q]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </PlayerContext.Provider>
  );
}

export function TrackList({ tracks, canPlay }: { tracks: PlayerTrack[]; canPlay: boolean }) {
  const { current, playing, play, toggle } = usePlayer();
  return (
    <ol className="divide-y divide-line border-y-2 border-fg">
      {tracks.map((t, i) => {
        const active = current?.id === t.id;
        return (
          <li key={t.id}>
            <button
              disabled={!canPlay}
              onClick={() => (active ? toggle() : play(tracks, i))}
              className={`flex w-full items-center gap-4 px-2 py-3 text-left disabled:cursor-not-allowed ${active ? "bg-fg text-bg" : "hover:bg-line disabled:hover:bg-transparent"}`}
            >
              <span className={`w-6 text-right font-mono text-sm ${active ? "text-accent" : "text-muted"}`}>{active && playing ? "▶" : i + 1}</span>
              <span className={`flex-1 truncate ${active ? "font-mono font-bold" : ""}`}>{t.title}</span>
              {t.hiRes && <span className="tag">hi-res</span>}
              <span className={`font-mono text-sm ${active ? "" : "text-muted"}`}>{fmtTime(t.durationSec)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
