/**
 * The Castalia mark: a C that opens into a play button, stamped into a box
 * with a hard offset shadow. Colours follow the theme.
 */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="7" y="7" width="38" height="38" className="fill-fg" />
      <rect x="3" y="3" width="38" height="38" className="fill-surface stroke-fg" strokeWidth="3" />
      <path d="M28 15.5A9.5 9.5 0 1 0 28 28.5" fill="none" className="stroke-fg" strokeWidth="4.5" />
      <path d="M25 16.8L34 22L25 27.2Z" className="fill-accent" />
    </svg>
  );
}
