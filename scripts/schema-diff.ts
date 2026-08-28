// Confronta lo schema Drizzle (shared/schema.ts) con le colonne reali del DB
// e stampa ciò che manca nel DB. Solo lettura: non modifica nulla.
import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { getTableColumns, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dbCols = new Map<string, Set<string>>();
const res = await pool.query(
  `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'`,
);
for (const r of res.rows) {
  if (!dbCols.has(r.table_name)) dbCols.set(r.table_name, new Set());
  dbCols.get(r.table_name)!.add(r.column_name);
}

for (const exported of Object.values(schema)) {
  if (!(exported instanceof PgTable)) continue;
  const tableName = getTableName(exported);
  const cols = getTableColumns(exported);
  const inDb = dbCols.get(tableName);
  if (!inDb) {
    console.log(`TABELLA MANCANTE: ${tableName}`);
    continue;
  }
  for (const col of Object.values(cols)) {
    if (!inDb.has(col.name)) {
      console.log(
        `COLONNA MANCANTE: ${tableName}.${col.name}  tipo=${col.getSQLType()}  notNull=${col.notNull}  hasDefault=${col.hasDefault}`,
      );
    }
  }
}
console.log("diff completato");
await pool.end();
