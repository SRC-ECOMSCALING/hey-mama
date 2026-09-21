// Assegna latitudine/longitudine ai profili che ne sono privi, ricavandole
// dalla provincia salvata in `location` (shared/provinces.ts). Idempotente:
// tocca solo i profili senza coordinate. Uso: npx tsx scripts/backfill-coordinates.ts
import "dotenv/config";
import pg from "pg";
import { coordinatesForProvince } from "../shared/provinces";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const { rows } = await pool.query<{ id: string; location: string | null }>(
  "SELECT id, location FROM profiles WHERE latitude IS NULL OR longitude IS NULL",
);

let updated = 0;
const unknown: string[] = [];
for (const row of rows) {
  const coords = coordinatesForProvince(row.location);
  if (!coords) {
    unknown.push(row.location ?? "(vuoto)");
    continue;
  }
  await pool.query("UPDATE profiles SET latitude = $1, longitude = $2 WHERE id = $3", [
    coords.latitude,
    coords.longitude,
    row.id,
  ]);
  updated++;
}

console.log(`profili senza coordinate: ${rows.length} | aggiornati: ${updated}`);
if (unknown.length) console.log("location non riconosciute (lasciate senza coordinate):", unknown);
await pool.end();
