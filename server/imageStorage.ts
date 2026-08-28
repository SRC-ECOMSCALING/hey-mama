// Postgres-backed image storage. The original implementation relied on the
// Replit object-storage sidecar (127.0.0.1:1106), which only exists on Replit,
// so every upload failed on Railway/local. Images now live in the
// uploaded_images table and are served by this server.
import { eq, sql } from "drizzle-orm";
import type { Request } from "express";
import { db } from "./db";
import { uploadedImages, type UploadedImage } from "@shared/schema";

// The live DB gets schema changes via additive SQL (drizzle push is unsafe
// against it). This table shipped without that step, so every upload/serve
// 500ed in production. Idempotent bootstrap: safe to run at every boot.
export async function ensureUploadedImagesTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS uploaded_images (
        id varchar PRIMARY KEY,
        data bytea NOT NULL,
        content_type varchar NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    // Probe so a broken table shape shows up in the logs at boot, not as
    // opaque 500s on user uploads.
    await db.select({ id: uploadedImages.id }).from(uploadedImages).limit(1);
    console.log("[IMAGES] uploaded_images table ready");
  } catch (error) {
    console.error("[IMAGES] uploaded_images bootstrap FAILED — photo uploads will not work:", error);
  }
}

// Max accepted upload size. Uppy limits client-side to 10MB; keep a margin.
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidImageId(id: string): boolean {
  return UUID_RE.test(id);
}

// Insert-only: image ids are public once referenced in photo URLs, so allowing
// overwrites would let anyone replace an existing user's picture. Returns false
// when the id already exists.
export async function saveImage(
  id: string,
  data: Buffer,
  contentType: string,
): Promise<boolean> {
  const inserted = await db
    .insert(uploadedImages)
    .values({ id, data, contentType })
    .onConflictDoNothing({ target: uploadedImages.id })
    .returning({ id: uploadedImages.id });
  return inserted.length > 0;
}

export async function getImage(id: string): Promise<UploadedImage | null> {
  const [row] = await db
    .select()
    .from(uploadedImages)
    .where(eq(uploadedImages.id, id));
  return row ?? null;
}

// Base URL of this server as seen by the client, honoring the proxy headers
// Railway sets. Upload/serving URLs must be absolute: the native (Capacitor)
// WebView cannot resolve relative URLs against the backend.
export function requestBaseUrl(req: Request): string {
  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)
    ?.split(",")[0]
    ?.trim();
  const proto = forwardedProto || req.protocol || "https";
  const host = req.get("host");
  return `${proto}://${host}`;
}

// Extract an image id from any of the URL shapes stored in the DB over time:
//   https://<backend>/api/uploads/<id>   (current)
//   /objects/uploads/<id>                (client-normalized legacy shape)
export function imageIdFromPath(path: string): string | null {
  const match = path.match(/\/(?:api\/)?(?:objects\/)?uploads\/([^/?#]+)/);
  const id = match?.[1];
  return id && isValidImageId(id) ? id : null;
}
