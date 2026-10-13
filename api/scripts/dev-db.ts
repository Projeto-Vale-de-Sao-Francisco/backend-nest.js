import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

// Postgres local para desenvolvimento/testes (sem Docker). Nao usar em producao.
const dataDir = "./.pgdata";
const port = Number(process.env.DEV_DB_PORT ?? 5433);
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port, persistent: true });

const primeiraVez = !existsSync(`${dataDir}/PG_VERSION`);
if (primeiraVez) await pg.initialise();
await pg.start();
if (primeiraVez) await pg.createDatabase("sivale");
console.log(`Postgres local pronto em postgresql://postgres:postgres@localhost:${port}/sivale (Ctrl+C para parar)`);

const parar = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", parar);
process.on("SIGTERM", parar);
