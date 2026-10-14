"use client";

import { useEffect, useRef, useState } from "react";

// Previews play on their own audio element so they never touch the main
// player's queue or play counting. Starting one stops any other preview and
// pauses the main player; the main player starting stops previews.
export const PREVIEW_EVENT = "castalia:preview";
export const PLAYER_EVENT = "castalia:player";

export function PreviewButton({ albumId, title, version, small = false }: { albumId: string; title: string; version: string; small?: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [left, setLeft] = useState(15);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stop = (e: Event) => {
      if (e.type === PREVIEW_EVENT && (e as CustomEvent<string>).detail === albumId) return;
      audio.current?.pause();
    };
    window.addEventListener(PREVIEW_EVENT, stop);
    window.addEventListener(PLAYER_EVENT, stop);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, stop);
      window.removeEventListener(PLAYER_EVENT, stop);
      audio.current?.pause();
    };
  }, [albumId]);

  // The artist saved a different preview: drop the old clip so the next
  // press loads the new one.
  useEffect(() => {
    return () => {
      const el = audio.current;
      if (!el) return;
      el.onpause = null;
      el.pause();
      el.removeAttribute("src");
      audio.current = null;
      setState("idle");
      setProgress(0);
      setLeft(15);
    };
  }, [version]);

  function toggle() {
    if (state === "playing" || state === "loading") {
      audio.current?.pause();
      return;
    }
    window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: albumId }));
    if (!audio.current) {
      const el = new Audio(`/api/preview/${albumId}?v=${encodeURIComponent(version)}`);
      el.preload = "auto";
      el.onplaying = () => setState("playing");
      el.onpause = () => {
        // A stopped preview starts from the beginning next time.
        el.currentTime = 0;
        setProgress(0);
        setLeft(15);
        setState((s) => (s === "error" ? s : "idle"));
      };
      el.onended = () => {
        el.currentTime = 0;
        setProgress(0);
      };
      el.onerror = () => setState("error");
      el.ontimeupdate = () => {
        const d = Number.isFinite(el.duration) ? el.duration : 15;
        setProgress(el.currentTime / d);
        setLeft(Math.max(0, Math.ceil(d - el.currentTime)));
      };
      audio.current = el;
    }
    setState("loading");
    audio.current.play().catch(() => setState("error"));
  }

  const label =
    state === "playing" ? `■ 0:${String(left).padStart(2, "0")}` : state === "loading" ? "loading…" : state === "error" ? "no preview" : "▶ preview";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={state === "playing" ? `Stop the preview of ${title}` : `Play a 15-second preview of ${title}`}
      className={`btn-ghost relative overflow-hidden ${small ? "px-2.5 py-1 text-xs" : ""}`}
    >
      <span className="tabular-nums">{label}</span>
      {state === "playing" && <span className="absolute bottom-0 left-0 h-1 bg-accent" style={{ width: `${progress * 100}%` }} />}
    </button>
  );
}
