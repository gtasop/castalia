import "server-only";
import { headers } from "next/headers";

// Fixed-window limits kept in memory. Enough for a single server; with
// several servers, move this to Redis or the database.

const windows = new Map<string, { count: number; resetAt: number }>();

/** Returns false when `key` has been used more than `limit` times in `windowSec`. */
export function allow(key: string, limit: number, windowSec: number): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    if (windows.size > 50_000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    return true;
  }
  w.count++;
  return w.count <= limit;
}

/** Best-effort client address (behind a proxy, the first forwarded hop). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}
