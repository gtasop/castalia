"use client";

import { useOptimistic, useTransition } from "react";

// Flips a track between open and locked in place: the switch changes at once
// while the server saves, without reloading the page or losing the scroll.
export function OpenToggle({
  albumId,
  trackId,
  number,
  open,
  action,
}: {
  albumId: string;
  trackId: string;
  number: number;
  open: boolean;
  action: (form: FormData) => Promise<void>;
}) {
  const [shown, setShown] = useOptimistic(open);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !shown;
    const form = new FormData();
    form.set("albumId", albumId);
    form.set("trackId", trackId);
    form.set("open", next ? "1" : "0");
    startTransition(async () => {
      setShown(next);
      await action(form);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={shown}
      aria-busy={pending}
      aria-label={`Track ${number} open to everyone`}
      className={`chip ${shown ? "border-accent bg-accent text-accent-fg" : "hover:bg-line"}`}
    >
      {shown ? "open ✓" : "make open"}
    </button>
  );
}
