import Link from "next/link";
import { MIN_AGE } from "@/lib/legal";

/** Required on sign-up: age and the terms. The links open in a new tab so the form isn't lost. */
export function TermsConsent() {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name="terms" value="1" required className="mt-1 size-4 shrink-0 accent-[var(--accent)]" />
      <span>
        I&apos;m {MIN_AGE} or older and agree to the{" "}
        <Link href="/terms" target="_blank" className="link">
          Terms
        </Link>
        . The{" "}
        <Link href="/privacy" target="_blank" className="link">
          Privacy policy
        </Link>{" "}
        explains how my data is used.
      </span>
    </label>
  );
}
