// Runs a local Postgres for development (no Docker or install needed).
// Data lives in ./.pgdata. Keep this running while you use the app.
//
// Usage: npm run db [-- <dataDir> <port>] (defaults: .pgdata, 5433)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.argv[2] ?? ".pgdata");
const port = Number(process.argv[3] ?? 5433);
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "castalia",
  password: "castalia",
  port,
  persistent: true,
  // Without these, initdb on Windows picks the system code page (e.g.
  // WIN1252), and any text outside it (Greek, CJK, emoji…) fails to save.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function main() {
  const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase("castalia");
  console.log(`Postgres running on localhost:${port} (database: castalia, data: ${dataDir}). Ctrl+C to stop.`);
}

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
