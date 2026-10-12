"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A header link that marks itself as the current page. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const current = path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`font-mono text-sm underline-offset-4 hover:text-fg hover:underline hover:decoration-accent hover:decoration-2 ${
        current ? "text-fg underline decoration-accent decoration-2" : "text-muted"
      }`}
    >
      {children}
    </Link>
  );
}
