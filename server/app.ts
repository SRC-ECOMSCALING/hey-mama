import express, { type Express, type Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { registerRoutes } from "./routes";
import { log } from "./static";

// Builds the Express app (middleware, API routes, error handler) without
// listening, so the same app runs as a long-lived server (server/index.ts)
// and as a Vercel function (server/vercel.ts).
export async function createApp(
  options: { beforeRoutes?: (app: Express) => void } = {},
): Promise<{ app: Express; server: Server }> {
  const app = express();
  // Hosted proxies (Vercel, Railway) terminate TLS in front of the app:
  // without trust proxy, req.secure is false and express-session never sets
  // the secure production cookie.
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  options.beforeRoutes?.(app);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Request error:", err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  return { app, server };
}
