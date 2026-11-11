// Migrazione additiva per il blocco "prima settimana" (RSVP eventi, messaggio
// nella richiesta, memoria del rifiuto, sospensione account, token push,
// privacy attività). Solo CREATE/ADD ... IF NOT EXISTS: idempotente, si può
// rieseguire. Uso: npx tsx scripts/migrate-2026-11-first-week.ts
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const statements = [
  // Account: sospensione + privacy attività
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false NOT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at timestamp`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS show_activity boolean DEFAULT true NOT NULL`,
  // Richieste di connessione: messaggio allegato + data di accettazione
  `ALTER TABLE matches ADD COLUMN IF NOT EXISTS message text`,
  `ALTER TABLE matches ADD COLUMN IF NOT EXISTS accepted_at timestamp`,
  // Memoria dei rifiuti
  `CREATE TABLE IF NOT EXISTS connection_declines (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id varchar NOT NULL,
     declined_user_id varchar NOT NULL,
     created_at timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS connection_declines_pair_idx ON connection_declines (declined_user_id, user_id)`,
  // Token push nativi
  `CREATE TABLE IF NOT EXISTS push_tokens (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id varchar NOT NULL,
     token text NOT NULL UNIQUE,
     platform varchar NOT NULL,
     created_at timestamp DEFAULT now() NOT NULL,
     updated_at timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id)`,
  // Eventi: pin sulla mappa + provincia
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS location_id varchar`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude text`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude text`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS province text`,
  // RSVP
  `CREATE TABLE IF NOT EXISTS event_rsvps (
     id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     event_id varchar NOT NULL,
     user_id varchar NOT NULL,
     status varchar DEFAULT 'going' NOT NULL,
     created_at timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS event_rsvps_event_user_idx ON event_rsvps (event_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS event_rsvps_user_idx ON event_rsvps (user_id)`,
  // Letture: indici utili per i contatori (no-op se già presenti)
  `CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient_id, is_read)`,
  `CREATE INDEX IF NOT EXISTS profiles_location_idx ON profiles (location)`,
];

for (const sql of statements) {
  await pool.query(sql);
  console.log("ok:", sql.replace(/\s+/g, " ").slice(0, 90));
}
console.log("migrazione completata");
await pool.end();
