// Creates (or refreshes) the demo account handed to App Store / Play reviewers.
//
//   DEMO_EMAIL=… DEMO_PASSWORD=… npx tsx scripts/create-demo-account.ts
//
// The account is a complete mom profile in a real province, flagged as a test
// profile so real users never see it on the map or in the zone counts. The
// script is idempotent: run it again to reset the password or the profile.
// Credentials come from the environment and are never written to the repo.
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";
import { scatteredCoordinatesForProvince } from "../shared/provinces";

const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
const password = process.env.DEMO_PASSWORD;
const province = process.env.DEMO_PROVINCE || "Novara";
if (!email || !password) {
  console.error("Set DEMO_EMAIL and DEMO_PASSWORD");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await client.query("select id from users where lower(email) = $1", [email]);
  let userId: string;
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
    await client.query(
      "update users set password_hash = $1, is_email_verified = true, is_suspended = false, updated_at = now() where id = $2",
      [passwordHash, userId],
    );
  } else {
    const inserted = await client.query(
      "insert into users (email, password_hash, is_email_verified, language) values ($1, $2, true, 'it') returning id",
      [email, passwordHash],
    );
    userId = inserted.rows[0].id;
  }

  // A neutral landscape picture already hosted by the app (the seed profile's)
  const photo = await client.query(
    "select p.photo_urls from profiles p join users u on u.id = p.user_id where u.email = 'sarah@example.com'",
  );
  const photoUrls: string[] = photo.rows[0]?.photo_urls ?? [];

  const coords = scatteredCoordinatesForProvince(province, userId);
  const profile = {
    firstName: "Giulia",
    lastName: "Demo",
    age: 33,
    sex: "female",
    bio: "Mamma di due bimbi, sempre in giro tra parco e biblioteca. Mi piace organizzare pomeriggi di gioco e scoprire posti nuovi.",
    kidsNumber: 2,
    kidsAges: ["2", "4"],
    kidsGenders: ["female", "male"],
    hobbies: ["Parchi e giochi", "Caffè e chiacchiere", "Libri"],
  };

  const hasProfile = await client.query("select id from profiles where user_id = $1", [userId]);
  if (hasProfile.rows.length > 0) {
    await client.query(
      `update profiles set account_type = 'mom', first_name = $2, last_name = $3, age = $4, sex = $5, bio = $6,
         location = $7, latitude = $8, longitude = $9, photo_urls = $10, kids_number = $11, kids_ages = $12,
         kids_genders = $13, hobbies = $14, is_test_profile = true, last_active_at = now()
       where user_id = $1`,
      [userId, profile.firstName, profile.lastName, profile.age, profile.sex, profile.bio, province,
        coords?.latitude ?? null, coords?.longitude ?? null, photoUrls, profile.kidsNumber, profile.kidsAges,
        profile.kidsGenders, profile.hobbies],
    );
  } else {
    await client.query(
      `insert into profiles (user_id, account_type, first_name, last_name, age, sex, bio, location, latitude, longitude,
         photo_urls, kids_number, kids_ages, kids_genders, hobbies, distance_away, is_test_profile)
       values ($1, 'mom', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '', true)`,
      [userId, profile.firstName, profile.lastName, profile.age, profile.sex, profile.bio, province,
        coords?.latitude ?? null, coords?.longitude ?? null, photoUrls, profile.kidsNumber, profile.kidsAges,
        profile.kidsGenders, profile.hobbies],
    );
  }

  await client.query("commit");
  const check = await client.query(
    "select u.email, u.is_email_verified, p.first_name, p.location, p.is_test_profile, p.latitude is not null as on_map from users u join profiles p on p.user_id = u.id where u.id = $1",
    [userId],
  );
  console.table(check.rows);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
