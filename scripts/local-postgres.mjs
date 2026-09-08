// Local-only helper: spins up a real Postgres instance without Docker or admin
// rights, for development/testing on machines that don't have Postgres or
// Docker installed. Not used in production — see README "Base de datos" section.
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.join(__dirname, "..", ".local-postgres");
const alreadyInitialised = existsSync(path.join(databaseDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: 5544,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const command = process.argv[2];

async function ensureDatabase() {
  try {
    await pg.createDatabase("mindyourswing");
  } catch {
    // already exists
  }
}

if (command === "stop") {
  if (alreadyInitialised) await pg.stop();
  process.exit(0);
}

if (!alreadyInitialised) await pg.initialise();
await pg.start();
await ensureDatabase();

console.log("Local Postgres listo en postgresql://postgres:postgres@localhost:5544/mindyourswing");

if (command === "start-and-exit") {
  process.exit(0);
}

process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});
