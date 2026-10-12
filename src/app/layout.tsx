import type { Metadata } from "next";
import { Inter_Tight, Space_Mono } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";
import { PlayerProvider } from "@/components/player";
import { ThemeToggle } from "@/components/theme";
import { currentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/payments";
import { themePreference } from "@/lib/theme";
import { logout } from "./actions";
import "./globals.css";

const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: { default: "Castalia", template: "%s · Castalia" },
  description: "Lossless music streaming where artists get everything except the hosting bill.",
};

const navLink = "font-mono text-sm text-muted underline-offset-4 hover:text-fg hover:underline hover:decoration-accent hover:decoration-2";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  const theme = await themePreference(user);
  return (
    <html lang="en" data-theme={theme === "system" ? undefined : theme}>
      <body className={`${interTight.variable} ${spaceMono.variable} font-sans antialiased`}>
        <PlayerProvider>
          {isDemoMode() && (
            <div className="bg-accent px-4 py-1 text-center font-mono text-xs text-accent-fg">
              demo mode: payments are simulated, no money moves
            </div>
          )}
          <header className="border-b-2 border-fg">
            {/* Phones: logo and account on the first row, site links below. Wider: one row. */}
            <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4" aria-label="Main">
              <Link href="/" className="mr-auto flex items-center gap-2.5" aria-label="Castalia home">
                <Logo />
                <span className="font-mono text-xl font-bold tracking-tighter">castalia</span>
              </Link>
              <div className="order-last flex w-full gap-x-5 sm:order-none sm:w-auto">
                <NavLink href="/albums">browse</NavLink>
                <NavLink href="/transparency">where the money goes</NavLink>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <ThemeToggle theme={theme} />
                {user ? (
                  <>
                    {user.artist && <NavLink href="/studio">studio</NavLink>}
                    {user.role === "ADMIN" && <NavLink href="/admin">admin</NavLink>}
                    <NavLink href="/account">
                      <span className="inline-block max-w-40 truncate align-bottom">{user.name}</span>
                    </NavLink>
                    <form action={logout}>
                      <button className={navLink}>log out</button>
                    </form>
                  </>
                ) : (
                  <>
                    <NavLink href="/login">log in</NavLink>
                    <Link href="/signup" className="btn px-3 py-1.5">
                      sign up
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 pt-10 pb-40">{children}</main>
        </PlayerProvider>
      </body>
    </html>
  );
}
