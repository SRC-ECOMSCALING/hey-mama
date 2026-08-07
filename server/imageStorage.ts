// Postgres-backed image storage. The original implementation relied on the
// Replit object-storage sidecar (127.0.0.1:1106), which only exists on Replit,
// so every upload failed on Railway/local. Images now live in the
// uploaded_images table and are served by this server.
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db } from "./db";
import { uploadedImages, type UploadedImage } from "@shared/schema";

// Max accepted upload size. Uppy limits client-side to 10MB; keep a margin.
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidImageId(id: string): boolean {
  return UUID_RE.test(id);
}

export async function saveImage(
  id: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  await db
    .insert(uploadedImages)
    .values({ id, data, contentType })
    .onConflictDoUpdate({
      target: uploadedImages.id,
      set: { data, contentType },
    });
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
