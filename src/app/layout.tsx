import type { Metadata } from "next";
import { Inter_Tight, Space_Mono } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/logo";
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
  title: "Castalia",
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
            <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4">
              <Link href="/" className="mr-auto flex items-center gap-2.5" aria-label="Castalia home">
                <Logo />
                <span className="font-mono text-xl font-bold tracking-tighter">castalia</span>
              </Link>
              <Link href="/transparency" className={navLink}>
                where the money goes
              </Link>
              <ThemeToggle theme={theme} />
              {user ? (
                <>
                  {user.artist && (
                    <Link href="/studio" className={navLink}>
                      studio
                    </Link>
                  )}
                  {user.role === "ADMIN" && (
                    <Link href="/admin" className={navLink}>
                      admin
                    </Link>
                  )}
                  <Link href="/account" className={navLink}>
                    {user.name}
                  </Link>
                  <form action={logout}>
                    <button className={navLink}>log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className={navLink}>
                    log in
                  </Link>
                  <Link href="/signup" className="btn">
                    sign up
                  </Link>
                </>
              )}
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 pt-10 pb-40">{children}</main>
        </PlayerProvider>
      </body>
    </html>
  );
}
