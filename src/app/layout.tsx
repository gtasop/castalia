import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { PlayerProvider } from "@/components/player";
import { currentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/payments";
import { logout } from "./actions";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Castalia",
  description: "Lossless music streaming where artists get everything except the hosting bill.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <PlayerProvider>
          {isDemoMode() && (
            <div className="bg-accent px-4 py-1 text-center text-xs text-accent-fg">
              Demo mode: payments are simulated, no money moves.
            </div>
          )}
          <header className="border-b border-line">
            <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 text-sm">
              <Link href="/" className="mr-auto text-lg font-semibold tracking-tight">
                Castalia
              </Link>
              <Link href="/transparency" className="text-muted hover:text-fg">
                Where the money goes
              </Link>
              {user ? (
                <>
                  {user.artist && (
                    <Link href="/studio" className="text-muted hover:text-fg">
                      Studio
                    </Link>
                  )}
                  {user.role === "ADMIN" && (
                    <Link href="/admin" className="text-muted hover:text-fg">
                      Admin
                    </Link>
                  )}
                  <Link href="/account" className="text-muted hover:text-fg">
                    {user.name}
                  </Link>
                  <form action={logout}>
                    <button className="text-muted hover:text-fg">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-muted hover:text-fg">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn">
                    Sign up
                  </Link>
                </>
              )}
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 pt-8 pb-40">{children}</main>
        </PlayerProvider>
      </body>
    </html>
  );
}
