// Confronta lo schema Drizzle (shared/schema.ts) con le colonne reali del DB
// e stampa ciò che manca nel DB. Solo lettura: non modifica nulla.
import "dotenv/config";
import pg from "pg";
import { getTableColumns, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const dbCols = new Map<string, Map<string, { nullable: boolean }>>();
const res = await pool.query(
  `SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema='public'`,
);
for (const r of res.rows) {
  if (!dbCols.has(r.table_name)) dbCols.set(r.table_name, new Map());
  dbCols
    .get(r.table_name)!
    .set(r.column_name, { nullable: r.is_nullable === "YES" });
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
    const dbCol = inDb.get(col.name);
    if (!dbCol) {
      console.log(
        `COLONNA MANCANTE: ${tableName}.${col.name}  tipo=${col.getSQLType()}  notNull=${col.notNull}  hasDefault=${col.hasDefault}`,
      );
      continue;
    }
    // NOT NULL nel DB ma nullable nello schema: gli insert del codice possono
    // scrivere NULL e violare il vincolo (visto con profiles.age dopo il
    // restore di uno snapshot vecchio). L'inverso è innocuo.
    if (!dbCol.nullable && !col.notNull) {
      console.log(
        `NULLABILITY: ${tableName}.${col.name} è NOT NULL nel DB ma facoltativa nello schema — serve: ALTER TABLE ${tableName} ALTER COLUMN ${col.name} DROP NOT NULL`,
      );
    }
  }
}
console.log("diff completato");
await pool.end();
