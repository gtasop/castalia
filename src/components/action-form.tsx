"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/lib/form-state";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/**
 * A form for an action that returns FormState on failure. Shows the error
 * at the top of the form (focused, so it is never off-screen and screen
 * readers announce it) and puts back what the person typed.
 */
export function ActionForm({ action, className, children }: { action: Action; className?: string; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  const error = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!state) return;
    // React resets the form after an action; restore the typed values next frame.
    const id = requestAnimationFrame(() => {
      if (form.current) restore(form.current, state.values);
      error.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [state]);

  return (
    <form ref={form} action={formAction} className={className} aria-busy={pending}>
      {state?.error && (
        <p ref={error} tabIndex={-1} role="alert" className="border-2 border-danger px-4 py-3 text-sm text-danger shadow-[3px_3px_0_var(--danger)] outline-none">
          <span className="mr-2 font-mono font-bold">!</span>
          {state.error}
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
