// Runs a local Postgres for development (no Docker or install needed).
// Data lives in ./.pgdata. Keep this running while you use the app.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".pgdata");
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "castalia",
  password: "castalia",
  port: 5433,
  persistent: true,
});

async function main() {
  const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase("castalia");
  console.log("Postgres running on localhost:5433 (database: castalia). Ctrl+C to stop.");
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
