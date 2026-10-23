// Vercel function entry: every /api and /objects request is routed here
// (see scripts/build-vercel.mjs). The client is served as static files by
// Vercel, so this only runs the API. The app is built once per instance and
// reused across requests.
import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "./app";

const ready = createApp().then(({ app }) => app);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await ready;
  app(req as any, res as any);
}
