import { setTheme } from "@/app/actions";
import { nextTheme, THEME_LABEL, THEMES, type ThemePref } from "@/lib/theme";

export function ThemeIcon({ theme, className = "h-4 w-4" }: { theme: ThemePref; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "square" as const, className, "aria-hidden": true };
  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="3" y="4" width="18" height="12" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/** Header button: shows the current theme, a click moves to the next one. */
export function ThemeToggle({ theme, className }: { theme: ThemePref; className?: string }) {
  const next = nextTheme(theme);
  const label = `Theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[next].toLowerCase()}`;
  return (
    <form action={setTheme} className={className}>
      <input type="hidden" name="theme" value={next} />
      <button
        aria-label={label}
        title={label}
        className="flex items-center rounded-lg border-[1.5px] border-edge bg-surface p-1.5 text-fg shadow-[2px_2px_0_var(--shadow)] hover:bg-line"
      >
        <ThemeIcon theme={theme} />
      </button>
    </form>
  );
}

/** Account page: all three choices, the current one pressed in. */
export function ThemePicker({ theme }: { theme: ThemePref }) {
  return (
    <form action={setTheme} className="mt-3 flex flex-wrap gap-3">
      {THEMES.map((t) => (
        <button
          key={t}
          name="theme"
          value={t}
          aria-pressed={t === theme}
          className={t === theme ? "btn translate-x-[3px] translate-y-[3px] shadow-none" : "btn-ghost"}
        >
          <ThemeIcon theme={t} />
          {THEME_LABEL[t].toLowerCase()}
        </button>
      ))}
    </form>
  );
}
