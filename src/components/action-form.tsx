"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/lib/form-state";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

const SUCCESS_MS = 4000;

/**
 * A form for an action that returns FormState. On failure it shows the error
 * at the top of the form (focused, so it is never off-screen and screen
 * readers announce it) and puts back what the person typed. On success it
 * shows the confirmation in place for a few seconds, or until closed.
 */
export function ActionForm({ action, className, children }: { action: Action; className?: string; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  // The result whose confirmation was closed; a new save shows its own again.
  const [closed, setClosed] = useState<FormState>(null);

  useEffect(() => {
    if (!state) return;
    // React resets the form after an action; put back what was typed (on
    // success that is exactly what was saved) on the next frame.
    const id = requestAnimationFrame(() => {
      if (form.current) restore(form.current, state.values);
      if (state.error) error.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [state]);

  useEffect(() => {
    if (!state?.success) return;
    const id = setTimeout(() => setClosed(state), SUCCESS_MS);
    return () => clearTimeout(id);
  }, [state]);

  return (
    <form ref={form} action={formAction} className={className} aria-busy={pending}>
      {state?.error && (
        <p ref={error} tabIndex={-1} role="alert" className="rounded-lg border-[1.5px] border-danger bg-danger/5 px-4 py-3 text-sm text-danger outline-none">
          <span className="mr-2 font-mono font-bold">!</span>
          {state.error}
        </p>
      )}
      {state?.success && closed !== state && (
        <p role="status" className="flex items-center gap-2 rounded-lg border-[1.5px] border-edge bg-accent/5 py-1 pr-1 pl-4 text-sm">
          <span className="font-mono font-bold text-accent">✓</span>
          <span className="flex-1">{state.success}</span>
          <button
            type="button"
            onClick={() => setClosed(state)}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-line hover:text-fg"
          >
            ×
          </button>
        </p>
      )}
      {children}
    </form>
  );
}

function restore(form: HTMLFormElement, values: Record<string, string | string[]>) {
  for (const [name, value] of Object.entries(values)) {
    const wanted = Array.isArray(value) ? value : [value];
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || el.name !== name) continue;
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) el.checked = wanted.includes(el.value);
      else if (!(el instanceof HTMLInputElement && (el.type === "hidden" || el.type === "password" || el.type === "file"))) el.value = wanted[0] ?? "";
    }
  }
}
