import type { Prisma } from "@prisma/client";

/**
 * Serialises work on `key` across concurrent requests (and servers): holds
 * a Postgres advisory lock until the surrounding transaction ends.
 */
export async function lock(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
