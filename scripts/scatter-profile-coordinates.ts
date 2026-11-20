// Sposta ogni profilo con una provincia riconosciuta sul suo punto stabile
// attorno al capoluogo (scatteredCoordinatesForProvince, seme = user id):
// prima tutte le mamme di una provincia stavano sullo stesso punto e sulla
// mappa se ne vedeva una sola. Deterministico e idempotente: rieseguirlo non
// sposta nulla. Uso: npx tsx scripts/scatter-profile-coordinates.ts [--dry-run]
import "dotenv/config";
import pg from "pg";
import { scatteredCoordinatesForProvince } from "../shared/provinces";

const dryRun = process.argv.includes("--dry-run");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const { rows } = await pool.query<{
  id: string;
  user_id: string;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
}>("SELECT id, user_id, location, latitude, longitude FROM profiles");

let moved = 0;
let unchanged = 0;
const unknown: string[] = [];
for (const row of rows) {
  const coords = scatteredCoordinatesForProvince(row.location, row.user_id);
  if (!coords) {
    unknown.push(row.location || "(vuota)");
    continue;
  }
  if (row.latitude === coords.latitude && row.longitude === coords.longitude) {
    unchanged++;
    continue;
  }
  if (!dryRun) {
    await pool.query("UPDATE profiles SET latitude = $1, longitude = $2 WHERE id = $3", [
      coords.latitude,
      coords.longitude,
      row.id,
    ]);
  }
  moved++;
}

console.log(`${dryRun ? "[dry-run] " : ""}profili: ${rows.length} | spostati: ${moved} | già a posto: ${unchanged}`);
if (unknown.length) console.log("location non riconosciute (lasciate invariate):", unknown);
await pool.end();
