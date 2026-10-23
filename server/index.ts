import "dotenv/config";

import express from "express";
import nodePath from "path";
import { createApp } from "./app";
import { serveStatic, log } from "./static";

(async () => {
  const { app, server } = await createApp({
    // Repo images referenced by demo/seed profiles (/attached_assets/...): the
    // folder is tracked in git, so it sits next to dist/ (prod) and server/ (dev).
    // On Vercel they ship as static files instead.
    beforeRoutes: (app) =>
      app.use(
        "/attached_assets",
        express.static(nodePath.resolve(import.meta.dirname, "..", "attached_assets")),
      ),
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Dynamically imported so Vite (a devDependency) is never required in production.
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  // Bind to 0.0.0.0 so the server is reachable when hosted;
  // falls back to localhost only if explicitly set via HOST.
  const host = process.env.HOST || "0.0.0.0";
  server.listen({
    port,
    host,
  }, () => {
    log(`serving on port ${port}`);
  });
})().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
