import { raw, type Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import {
  MAX_IMAGE_BYTES,
  getImage,
  imageIdFromPath,
  isValidImageId,
  requestBaseUrl,
  saveImage,
} from "./imageStorage";
import { insertSwipeSchema, insertMessageSchema, insertReviewSchema, insertLookingForPostSchema, insertServiceSchema, insertServiceLookingForPostSchema, insertLocationSchema, insertEventSchema, registrationSchema, loginSchema, updateProfileSchema, type Profile, type MarketplaceItem } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cookieSignature from "cookie-signature";
import { emailService } from "./emailService";
import { importOsmParks } from "./osmImport";
import pg from "pg";
import multer from "multer";
import { parse } from "csv-parse/sync";

// Session middleware configuration
const SESSION_SECRET = process.env.SESSION_SECRET || "your-secret-key-here";
const SESSION_COOKIE_NAME = "heymama.sid";
const PgSession = connectPgSimple(session);

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    pendingRegistration?: any;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create PostgreSQL connection pool for sessions
  const pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // CORS — required so native (Capacitor) WebViews, served from
  // capacitor://localhost / http://localhost, can call this backend.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Credentials", "true");
      res.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      // Uppy (@uppy/aws-s3) must read the ETag of the upload PUT response;
      // cross-origin (native WebView) that needs an explicit expose, or the
      // upload hangs at 100% forever.
      res.header("Access-Control-Expose-Headers", "ETag, Location");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // Bearer-token auth for native clients: cross-site session cookies are
  // unreliable in mobile WebViews, so native sends the session id as
  // `Authorization: Bearer <token>`. Reconstruct the signed session cookie
  // here (before express-session) so the existing session machinery —
  // and every `req.session.userId` read downstream — works unchanged.
  app.use((req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const sid = authHeader.slice(7).trim();
      const hasCookie = (req.headers.cookie || "").includes(
        `${SESSION_COOKIE_NAME}=`,
      );
      if (sid && !hasCookie) {
        const signed = "s:" + cookieSignature.sign(sid, SESSION_SECRET);
        const cookiePair = `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`;
        req.headers.cookie = req.headers.cookie
          ? `${req.headers.cookie}; ${cookiePair}`
          : cookiePair;
      }
    }
    next();
  });

  // Configure session middleware with PostgreSQL persistence
  app.use(session({
    store: new PgSession({
      pool: pgPool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Extend session on activity
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS in production
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for persistent sessions
      sameSite: 'lax', // Better CSRF protection
    },
    name: SESSION_COOKIE_NAME, // Custom session name
  }));

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    console.log(`[AUTH] Session check for ${req.method} ${req.path}:`, {
      sessionId: req.sessionID,
      userId: req.session.userId,
      hasSession: !!req.session
    });
    
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Admin allowlist: comma-separated emails in ADMIN_EMAILS, defaulting to the
  // original hardcoded admin. Lets the owner grant admin without code changes.
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "admin@claudio.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdminEmail = (email?: string | null) =>
    !!email && ADMIN_EMAILS.includes(email.toLowerCase());
  // Effective admin = bootstrap env email OR DB-granted (is_admin) from dashboard.
  const isUserAdmin = (user?: { email?: string | null; isAdmin?: boolean } | null) =>
    !!user && (isAdminEmail(user.email) || user.isAdmin === true);

  // Admin middleware
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUserById(req.session.userId);
    if (!isUserAdmin(user)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  };


  // Object storage service
  const objectStorageService = new ObjectStorageService();

  // ===== Image URL normalization =====
  // Photo URLs have been stored in several shapes over time (absolute URLs of
  // old deployments, relative /objects/uploads/<id>, presigned GCS links).
  // Whenever an uploaded image id can be recovered, rewrite the URL to this
  // server's public serving endpoint so pictures load on web AND in the
  // native WebView (which cannot resolve relative <img> sources).
  const normalizeImageUrl = (req: any, url: string | null | undefined): string | null => {
    if (!url) return url ?? null;
    const id = imageIdFromPath(url);
    return id ? `${requestBaseUrl(req)}/api/uploads/${id}` : url;
  };

  const normalizeProfileImages = <T extends Profile | null | undefined>(req: any, profile: T): T => {
    if (!profile) return profile;
    return {
      ...profile,
      photoUrls: (profile.photoUrls || []).map((u) => normalizeImageUrl(req, u) as string),
    };
  };

  const normalizeItemImages = <T extends MarketplaceItem | null | undefined>(req: any, item: T): T => {
    if (!item) return item;
    return {
      ...item,
      imageUrls: (item.imageUrls || []).map((u) => normalizeImageUrl(req, u) as string),
    };
  };


  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const registrationData = registrationSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(registrationData.email);
      if (existingUser) {
        return res.status(409).json({ message: "User with this email already exists" });
      }
      
      // Try to send verification email
      let emailSent = false;
      let verificationCode = "";
      try {
        verificationCode = emailService.generateVerificationCode();
        const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await emailService.sendVerificationEmail(registrationData.email, verificationCode);
        // Store registration data temporarily in session
        req.session.pendingRegistration = {
          ...registrationData,
          verificationCode,
          verificationExpiry: verificationExpiry.toISOString()
        };
        emailSent = true;
      } catch (emailError: any) {
        console.error("Email service unavailable, creating account directly:", emailError.message);
      }

      if (emailSent) {
        return res.status(200).json({
          message: "Verification email sent",
          email: registrationData.email,
          requiresVerification: true,
          token: req.sessionID, // Carries the pending-registration session for native verify-email
        });
      }

      // Email service unavailable — create account directly without email verification
      const { user, profile } = await storage.register({
        ...registrationData,
        isEmailVerified: false
      });
      await storage.setTermsAccepted(user.id); // accepted via the registration form
      req.session.userId = user.id;

      return res.status(201).json({
        message: "Registration completed",
        user: { id: user.id, email: user.email },
        profile,
        requiresVerification: false,
        token: req.sessionID, // For native clients (Authorization: Bearer)
      });

    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginData = loginSchema.parse(req.body);
      const user = await storage.login(loginData);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      console.log(`[AUTH] Login successful for user ${user.id}, session ${req.sessionID}`);
      
      res.json({
        message: "Login successful",
        user: { id: user.id, email: user.email },
        token: req.sessionID, // For native clients (Authorization: Bearer)
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Login failed" });
    }
  });

  // Email verification endpoint
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { verificationCode } = req.body;
      
      if (!verificationCode) {
        return res.status(400).json({ message: "Verification code is required" });
      }
      
      const pendingRegistration = req.session.pendingRegistration;
      if (!pendingRegistration) {
        return res.status(400).json({ message: "No pending registration found" });
      }
      
      // Check if code matches and hasn't expired
      const now = new Date();
      const expiryDate = new Date(pendingRegistration.verificationExpiry);
      
      if (now > expiryDate) {
        // Clear expired registration
        delete req.session.pendingRegistration;
        return res.status(400).json({ message: "Verification code has expired" });
      }
      
      if (pendingRegistration.verificationCode !== verificationCode) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      
      // Create the user account
      const { user, profile } = await storage.register({
        ...pendingRegistration,
        isEmailVerified: true
      });
      await storage.setTermsAccepted(user.id); // accepted via the registration form

      // Clear pending registration
      delete req.session.pendingRegistration;
      
      // Set session
      req.session.userId = user.id;
      
      res.status(201).json({
        message: "Email verified and registration completed",
        user: { id: user.id, email: user.email },
        profile,
        token: req.sessionID, // For native clients (Authorization: Bearer)
      });
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(400).json({ message: "Email verification failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const profile = await storage.getProfile(req.session.userId).catch(() => undefined);
      res.json({
        id: user.id,
        email: user.email,
        language: user.language || "it",
        accountType: profile?.accountType || "mom",
        termsAccepted: !!user.termsAcceptedAt,
        isAdmin: isUserAdmin(user),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Delete the logged-in user's own account and all related data (App Store 5.1.1)
  app.delete("/api/auth/account", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await storage.deleteUserCompletely(userId);
      req.session.destroy(() => {});
      res.json({ message: "Account eliminato" });
    } catch (error) {
      console.error("Account deletion error:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Record acceptance of Terms of Use + Privacy Policy for the logged-in user
  app.post("/api/auth/accept-terms", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.setTermsAccepted(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ termsAccepted: !!user.termsAcceptedAt });
    } catch (error) {
      console.error("Accept terms error:", error);
      res.status(500).json({ message: "Failed to accept terms" });
    }
  });


  // Create Stripe checkout session

  // Verify and activate subscription after successful Stripe checkout (no auth required)


  // Create Stripe customer portal session


  // Object storage routes
  app.get("/objects/:objectPath(*)", requireAuth, async (req: any, res) => {
    const userId = req.session.userId;
    console.log(`[OBJECT] Serving ${req.path} for user ${userId}`);
    // Postgres-stored images first (/objects/uploads/<uuid> URLs saved by the
    // client); the code below only handles legacy Replit object storage.
    const imageId = imageIdFromPath(req.path);
    if (imageId) {
      const image = await getImage(imageId).catch(() => null);
      if (image) {
        res.set({
          "Content-Type": image.contentType,
          "Content-Length": String(image.data.length),
          "Cache-Control": "public, max-age=31536000, immutable",
        });
        return res.end(image.data);
      }
    }
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      console.log(`[OBJECT] File found for ${req.path}`);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      console.log(`[OBJECT] Access check result for ${req.path}: ${canAccess}`);
      if (!canAccess) {
        console.log(`[OBJECT] Access denied for ${req.path}`);
        return res.sendStatus(401);
      }
      console.log(`[OBJECT] Downloading ${req.path}`);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        console.log(`[OBJECT] Object not found: ${req.path}`);
        return res.sendStatus(404);
      }
      console.log(`[OBJECT] Server error for ${req.path}`);
      return res.sendStatus(500);
    }
  });

  // Images are stored in Postgres and served by this server (the previous
  // Replit object storage only worked on Replit). The upload endpoints hand
  // out an absolute PUT URL on this server; the client uploads the file there
  // and stores that same URL as the photo URL.
  const makeUploadURL = (req: any) =>
    `${requestBaseUrl(req)}/api/uploads/${randomUUID()}`;

  // Public upload route for registration (no auth required)
  app.post("/api/objects/upload/public", async (req, res) => {
    res.json({ uploadURL: makeUploadURL(req) });
  });

  // Authenticated upload route for logged-in users
  app.post("/api/objects/upload", requireAuth, async (req: any, res) => {
    res.json({ uploadURL: makeUploadURL(req) });
  });

  // Receives the image bytes for an upload URL issued above
  app.put(
    "/api/uploads/:id",
    raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
    async (req, res) => {
      try {
        const { id } = req.params;
        if (!isValidImageId(id)) {
          return res.status(400).json({ error: "Invalid image id" });
        }
        // Some WebViews/pickers send no content type at all — treat those as
        // binary images rather than rejecting the upload.
        const contentType =
          (req.headers["content-type"] as string | undefined)?.trim() ||
          "application/octet-stream";
        if (
          !contentType.startsWith("image/") &&
          contentType !== "application/octet-stream"
        ) {
          return res.status(400).json({ error: "Only images are accepted" });
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ error: "Empty upload" });
        }
        await saveImage(id, req.body, contentType);
        res.sendStatus(200);
      } catch (error) {
        console.error("Error storing upload:", error);
        res.status(500).json({ error: "Failed to store upload" });
      }
    },
  );

  // Serves uploaded images. Public: profile photos are shown during
  // registration (before login) and in native WebViews without cookies.
  app.get("/api/uploads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidImageId(id)) {
        return res.sendStatus(404);
      }
      const image = await getImage(id);
      if (!image) {
        return res.sendStatus(404);
      }
      res.set({
        "Content-Type": image.contentType,
        "Content-Length": String(image.data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      res.end(image.data);
    } catch (error) {
      console.error("Error serving upload:", error);
      res.sendStatus(500);
    }
  });

  app.put("/api/profile-photos", requireAuth, async (req: any, res) => {
    if (!req.body.photoURL) {
      return res.status(400).json({ error: "photoURL is required" });
    }

    const userId = req.session.userId;

    try {
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.photoURL,
        {
          owner: userId,
          visibility: "public", // Profile photos are public
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting profile photo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Global admin switch: when showTestProfiles is "false", test profiles are
  // hidden from discovery and the map for everyone.
  const shouldShowTestProfiles = async (): Promise<boolean> => {
    try {
      return (await storage.getSetting("showTestProfiles")) !== "false";
    } catch {
      return true; // fail open: never hide real content because of a settings error
    }
  };

  // ===== App Store 1.2: user blocking + content reporting =====

  // Ids of users blocked by / blocking the given user. Their content must be
  // hidden from every feed. Fails closed to an empty set so a DB hiccup never
  // breaks the feeds themselves.
  const getBlockedSet = async (userId?: string): Promise<Set<string>> => {
    if (!userId) return new Set();
    try {
      return new Set(await storage.getBlockedUserIds(userId));
    } catch {
      return new Set();
    }
  };

  // Email the developer/admins about a new report or block. Best-effort:
  // a Brevo outage must never make the report/block action fail.
  const notifyAdminsOfReport = async (subject: string, lines: string[]) => {
    try {
      const html = `<h2>${subject}</h2><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
        <p>Gestisci la segnalazione dalla dashboard admin dell'app (sezione Segnalazioni).</p>`;
      await Promise.all(ADMIN_EMAILS.map((to) =>
        emailService.sendEmail({
          to,
          subject: `[HeyMama moderazione] ${subject}`,
          htmlContent: html,
          textContent: `${subject}\n${lines.join("\n")}`,
        })
      ));
    } catch (err: any) {
      console.error("Failed to email admins about report:", err?.message || err);
    }
  };

  const describeUser = async (userId?: string | null): Promise<string> => {
    if (!userId) return "sconosciuto";
    try {
      const [user, profile] = await Promise.all([
        storage.getUserById(userId),
        storage.getProfile(userId),
      ]);
      const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
      return `${name || "(senza profilo)"} <${user?.email || userId}>`;
    } catch {
      return userId;
    }
  };

  const REPORT_TARGET_TYPES = ["profile", "marketplace_item", "service", "message", "review", "user_block"];

  // Flag objectionable content
  app.post("/api/reports", requireAuth, async (req: any, res) => {
    try {
      const { targetType, targetId, reportedUserId, reason, details } = req.body || {};
      if (!targetType || !REPORT_TARGET_TYPES.includes(targetType)) {
        return res.status(400).json({ message: "Invalid targetType" });
      }
      if (!reason || typeof reason !== "string") {
        return res.status(400).json({ message: "reason is required" });
      }
      const report = await storage.createReport({
        reporterId: req.session.userId,
        reportedUserId: reportedUserId || null,
        targetType,
        targetId: targetId || null,
        reason,
        details: typeof details === "string" && details.trim() ? details.trim() : null,
      });
      const [reporter, reported] = await Promise.all([
        describeUser(req.session.userId),
        describeUser(reportedUserId),
      ]);
      await notifyAdminsOfReport("Nuova segnalazione di contenuto", [
        `Segnalato da: ${reporter}`,
        `Utente segnalato: ${reported}`,
        `Tipo contenuto: ${targetType}`,
        `Id contenuto: ${targetId || "-"}`,
        `Motivo: ${reason}`,
        `Dettagli: ${details || "-"}`,
      ]);
      res.status(201).json({ message: "Report submitted", report });
    } catch (error) {
      console.error("Create report error:", error);
      res.status(500).json({ message: "Failed to submit report" });
    }
  });

  // Block a user (also notifies the developer, per App Store 1.2)
  app.post("/api/blocks", requireAuth, async (req: any, res) => {
    try {
      const { blockedUserId, reason } = req.body || {};
      if (!blockedUserId || typeof blockedUserId !== "string") {
        return res.status(400).json({ message: "blockedUserId is required" });
      }
      if (blockedUserId === req.session.userId) {
        return res.status(400).json({ message: "Cannot block yourself" });
      }
      const block = await storage.blockUser(req.session.userId, blockedUserId);
      // Every block is also recorded as a report so admins can review the user.
      await storage.createReport({
        reporterId: req.session.userId,
        reportedUserId: blockedUserId,
        targetType: "user_block",
        targetId: blockedUserId,
        reason: typeof reason === "string" && reason.trim() ? reason.trim() : "blocked",
        details: null,
      });
      const [blocker, blocked] = await Promise.all([
        describeUser(req.session.userId),
        describeUser(blockedUserId),
      ]);
      await notifyAdminsOfReport("Utente bloccato", [
        `Bloccato da: ${blocker}`,
        `Utente bloccato: ${blocked}`,
        `Motivo: ${reason || "-"}`,
      ]);
      res.status(201).json({ message: "User blocked", block });
    } catch (error) {
      console.error("Block user error:", error);
      res.status(500).json({ message: "Failed to block user" });
    }
  });

  // Unblock a user
  app.delete("/api/blocks/:blockedUserId", requireAuth, async (req: any, res) => {
    try {
      await storage.unblockUser(req.session.userId, req.params.blockedUserId);
      res.json({ message: "User unblocked" });
    } catch (error) {
      console.error("Unblock user error:", error);
      res.status(500).json({ message: "Failed to unblock user" });
    }
  });

  // List users blocked by the current user (for the settings page)
  app.get("/api/blocks", requireAuth, async (req: any, res) => {
    try {
      const userBlocks = await storage.getBlocksByUser(req.session.userId);
      const withProfiles = await Promise.all(
        userBlocks.map(async (b) => ({
          ...b,
          profile: (await storage.getProfile(b.blockedId)) ?? null,
        })),
      );
      res.json(withProfiles);
    } catch (error) {
      console.error("List blocks error:", error);
      res.status(500).json({ message: "Failed to fetch blocked users" });
    }
  });

  // Get all profiles for discovery (requires active subscription)
  app.get("/api/profiles/discover/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      let profiles = await storage.getDiscoverableProfiles(userId);
      if (!(await shouldShowTestProfiles())) {
        profiles = profiles.filter((p) => !p.isTestProfile);
      }
      const blocked = await getBlockedSet(req.session.userId);
      profiles = profiles.filter((p) => !blocked.has(p.userId));
      res.json(profiles.map((p) => normalizeProfileImages(req, p)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profiles" });
    }
  });

  // Get mom profiles for map display (professionals are listed in "Intorno a te")
  app.get("/api/profiles/map", requireAuth, async (req, res) => {
    try {
      let allProfiles = await storage.getAllMomProfiles();
      if (!(await shouldShowTestProfiles())) {
        allProfiles = allProfiles.filter((p) => !p.isTestProfile);
      }
      const blocked = await getBlockedSet(req.session.userId);
      allProfiles = allProfiles.filter((p) => !blocked.has(p.userId));
      res.json(allProfiles.map((p) => normalizeProfileImages(req, p)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profiles" });
    }
  });

  // Professionals directory ("Intorno a te" tab): professional profiles with
  // the services they offer.
  app.get("/api/professionals", requireAuth, async (req: any, res) => {
    try {
      let pros = await storage.getProfessionalProfiles();
      if (!(await shouldShowTestProfiles())) {
        pros = pros.filter((p) => !p.isTestProfile);
      }
      const blocked = await getBlockedSet(req.session.userId);
      pros = pros.filter((p) => !blocked.has(p.userId));
      const withServices = await Promise.all(
        pros.map(async (p) => ({
          ...normalizeProfileImages(req, p),
          services: await storage.getServicesByProvider(p.userId),
        })),
      );
      res.json(withServices);
    } catch (error) {
      console.error("Professionals list error:", error);
      res.status(500).json({ message: "Failed to fetch professionals" });
    }
  });

  // Get current user's own profile
  app.get("/api/profiles/current-user", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      // Auto-create a minimal profile for legacy accounts that never had one,
      // so the profile page works instead of dead-ending on "profilo non trovato".
      const profile = await storage.ensureProfile(userId);
      res.json(normalizeProfileImages(req, profile));
    } catch (error) {
      console.error("Error fetching current user profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Get specific profile by ID
  app.get("/api/profiles/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await storage.getProfile(id);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      res.json(normalizeProfileImages(req, profile));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Update profile
  app.put("/api/profiles/:id", requireAuth, async (req: any, res) => {
    try {
      let userId = req.params.id;
      const updateData = updateProfileSchema.parse(req.body);
      
      // Handle "current-user" special case
      if (userId === "current-user") {
        userId = req.session.userId;
      }
      
      // Ensure user can only update their own profile
      if (userId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized to update this profile" });
      }
      
      const updatedProfile = await storage.updateProfile(userId, updateData);
      if (!updatedProfile) {
        // Legacy account with no profile row: create it from the provided data
        // so the user can self-heal by saving from the profile edit page.
        const created = await storage.createProfile({
          userId,
          firstName: "",
          lastName: "",
          age: 18,
          sex: "female",
          bio: "",
          location: "",
          photoUrls: [],
          kidsNumber: 0,
          kidsAges: [],
          hobbies: [],
          distanceAway: "0 km",
          ...updateData,
        } as any);
        return res.json(created);
      }

      res.json(updatedProfile);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Create a swipe. A "like" sends a CONNECTION REQUEST (match.isMatch=false):
  // messaging opens only after the other mom accepts. If she had already sent
  // a request to us, liking her accepts it.
  app.post("/api/swipes", requireAuth, async (req, res) => {
    try {
      // Always use the authenticated user as the actor (ignore client "current-user").
      const parsed = insertSwipeSchema.parse(req.body);
      const swipeData = { ...parsed, userId: (req as any).session.userId };

      const swipe = await storage.createSwipe(swipeData);

      let match = null;
      if (swipeData.isLike) {
        const existing = await storage.getMatch(swipeData.userId, swipeData.targetUserId);
        if (existing && !existing.isMatch && existing.userId === swipeData.targetUserId) {
          // She asked first — liking back accepts her request.
          match = await storage.acceptMatch(existing.id) ?? existing;
          try {
            await storage.createNotification({
              type: 'match',
              senderId: swipeData.userId,
              recipientId: swipeData.targetUserId,
              message: 'La tua richiesta di connessione è stata accettata!',
              relatedId: match.id,
              isRead: false
            });
          } catch (notificationError) {
            console.error("Error creating accept notification:", notificationError);
          }
        } else if (existing) {
          match = existing;
        } else {
          match = await storage.createMatch({
            userId: swipeData.userId,
            matchedUserId: swipeData.targetUserId,
            isMatch: false, // pending request until accepted
          });
          try {
            await storage.createNotification({
              type: 'connection_request',
              senderId: swipeData.userId,
              recipientId: swipeData.targetUserId,
              message: 'Hai ricevuto una richiesta di connessione!',
              relatedId: match.id,
              isRead: false
            });
          } catch (notificationError) {
            console.error("Error creating connection notification:", notificationError);
          }
        }
      }

      res.json({
        swipe,
        match,
        connected: !!match?.isMatch,
        requested: !!match && !match.isMatch,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid swipe data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create swipe" });
    }
  });

  // ===== Connection requests =====

  // Incoming + outgoing pending requests for the current user
  app.get("/api/connections/requests", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const blocked = await getBlockedSet(userId);
      const [incoming, outgoing] = await Promise.all([
        storage.getIncomingRequests(userId),
        storage.getOutgoingRequests(userId),
      ]);
      const withProfiles = async (rows: typeof incoming, otherIdOf: (m: typeof incoming[number]) => string) =>
        (await Promise.all(
          rows
            .filter((m) => !blocked.has(otherIdOf(m)))
            .map(async (m) => ({
              ...m,
              otherUserId: otherIdOf(m),
              profile: normalizeProfileImages(req, await storage.getProfile(otherIdOf(m)) ?? null),
            })),
        )).filter((m) => m.profile);
      res.json({
        incoming: await withProfiles(incoming, (m) => m.userId),
        outgoing: await withProfiles(outgoing, (m) => m.matchedUserId),
      });
    } catch (error) {
      console.error("Connection requests error:", error);
      res.status(500).json({ message: "Failed to fetch connection requests" });
    }
  });

  // Connection status per user id: 'connected' | 'pending_sent' | 'pending_received'.
  // Used by the map (white/pink/photo markers) and the discover deck.
  app.get("/api/connections/status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const all = await storage.getMatchesByUser(userId);
      const statuses: Record<string, string> = {};
      for (const m of all) {
        const otherId = m.userId === userId ? m.matchedUserId : m.userId;
        if (m.isMatch) {
          statuses[otherId] = "connected";
        } else if (statuses[otherId] !== "connected") {
          statuses[otherId] = m.userId === userId ? "pending_sent" : "pending_received";
        }
      }
      res.json(statuses);
    } catch (error) {
      console.error("Connection status error:", error);
      res.status(500).json({ message: "Failed to fetch connection status" });
    }
  });

  // Accept an incoming request (only the recipient can)
  app.post("/api/connections/:matchId/accept", requireAuth, async (req: any, res) => {
    try {
      const match = await storage.getMatchById(req.params.matchId);
      if (!match) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (match.matchedUserId !== req.session.userId) {
        return res.status(403).json({ message: "Only the recipient can accept this request" });
      }
      const accepted = await storage.acceptMatch(match.id);
      try {
        await storage.createNotification({
          type: 'match',
          senderId: req.session.userId,
          recipientId: match.userId,
          message: 'La tua richiesta di connessione è stata accettata!',
          relatedId: match.id,
          isRead: false,
        });
      } catch (notificationError) {
        console.error("Error creating accept notification:", notificationError);
      }
      res.json(accepted);
    } catch (error) {
      console.error("Accept connection error:", error);
      res.status(500).json({ message: "Failed to accept request" });
    }
  });

  // Decline an incoming request (or cancel one you sent)
  app.post("/api/connections/:matchId/decline", requireAuth, async (req: any, res) => {
    try {
      const match = await storage.getMatchById(req.params.matchId);
      if (!match) {
        return res.status(404).json({ message: "Request not found" });
      }
      const userId = req.session.userId;
      if (match.matchedUserId !== userId && match.userId !== userId) {
        return res.status(403).json({ message: "Not part of this request" });
      }
      if (match.isMatch) {
        return res.status(400).json({ message: "Connection already accepted" });
      }
      await storage.deleteMatch(match.id);
      res.json({ message: "Request removed" });
    } catch (error) {
      console.error("Decline connection error:", error);
      res.status(500).json({ message: "Failed to decline request" });
    }
  });

  // Get matches for a user
  app.get("/api/matches/:userId", async (req, res) => {
    try {
      let { userId } = req.params;
      
      // Handle "current-user" placeholder
      if (userId === "current-user") {
        if (!req.session.userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        userId = req.session.userId;
      }
      
      // Accepted connections only (isMatch=true); pending requests live in
      // /api/connections/requests. Blocked users' connections are hidden.
      const blocked = await getBlockedSet(userId);
      const seenPairs = new Set<string>();
      const acceptedMatches = (await storage.getMatchesByUser(userId)).filter((m) => {
        if (!m.isMatch) return false;
        const otherUserId = m.userId === userId ? m.matchedUserId : m.userId;
        if (blocked.has(otherUserId)) return false;
        const pairKey = [userId, otherUserId].sort().join('-');
        if (seenPairs.has(pairKey)) return false;
        seenPairs.add(pairKey);
        return true;
      });

      // Get profile information for matched users
      const matchesWithProfiles = await Promise.all(
        acceptedMatches.map(async (match) => {
          const matchedUserId = match.userId === userId ? match.matchedUserId : match.userId;
          const profile = normalizeProfileImages(req, await storage.getProfile(matchedUserId) ?? null);
          return {
            ...match,
            profile,
            matchedUserId, // Add this for easier access
          };
        })
      );

      res.json(matchesWithProfiles.filter((m) => m.profile));
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

  // Get messages for a match
  app.get("/api/messages/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;
      const messages = await storage.getMessagesByMatch(matchId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Start a conversation (finds match and returns match info for messaging)
  app.post("/api/conversations", async (req, res) => {
    try {
      const { matchedUserId } = req.body;
      
      if (!req.session.userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Blocked users can't start conversations with each other
      if (await storage.isBlockedBetween(req.session.userId, matchedUserId)) {
        return res.status(403).json({ message: "User is blocked" });
      }

      // Find the match between current user and matched user
      const match = await storage.getMatch(req.session.userId, matchedUserId);

      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      // Messaging requires an ACCEPTED connection
      if (!match.isMatch) {
        return res.status(403).json({ message: "Connection not accepted yet" });
      }

      // Get the matched user's profile for conversation display
      const profile = normalizeProfileImages(req, await storage.getProfile(matchedUserId) ?? null);
      
      // Return the conversation info (match + profile)
      res.json({
        matchId: match.id,
        match,
        profile,
        otherUserId: matchedUserId,
      });
    } catch (error) {
      console.error("Error starting conversation:", error);
      res.status(500).json({ message: "Failed to start conversation" });
    }
  });

  // Get conversations for a user (matches with messages)
  app.get("/api/conversations/:userId", async (req, res) => {
    try {
      let { userId } = req.params;
      
      if (userId === "current-user") {
        if (!req.session.userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        userId = req.session.userId;
      }
      
      const blocked = await getBlockedSet(userId);
      const matches = await storage.getMatchesByUser(userId);

      // Only return matches that have messages (active conversations)
      const conversationsWithMessages = [];

      for (const match of matches) {
        if (!match.isMatch) continue; // pending requests have no conversation
        const otherParticipantId = match.userId === userId ? match.matchedUserId : match.userId;
        if (blocked.has(otherParticipantId)) continue; // hide blocked users' conversations
        const messages = await storage.getMessagesByMatch(match.id);
        if (messages.length > 0) {
          const otherUserId = otherParticipantId;
          const profile = normalizeProfileImages(req, await storage.getProfile(otherUserId) ?? null);
          const lastMessage = messages[messages.length - 1]; // Get the latest message
          
          conversationsWithMessages.push({
            matchId: match.id,
            match,
            profile,
            otherUserId,
            lastMessage,
            messageCount: messages.length,
          });
        }
      }
      
      // Sort by last message time
      conversationsWithMessages.sort((a, b) => 
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      );
      
      res.json(conversationsWithMessages);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Send a message
  app.post("/api/messages", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const messageData = insertMessageSchema.parse(req.body);
      
      // Override senderId with session userId for security
      messageData.senderId = req.session.userId;
      
      // Verify sender is a participant in the match
      const match = await storage.getMatchById(messageData.matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      // Check if the current user is a participant in this match and it's confirmed
      if (match.userId !== messageData.senderId && match.matchedUserId !== messageData.senderId) {
        return res.status(403).json({ message: "Unauthorized to send message in this match" });
      }
      
      // Ensure this is a confirmed mutual match
      if (!match.isMatch) {
        return res.status(403).json({ message: "Cannot send message to unconfirmed match" });
      }

      // Blocked users can't message each other
      const otherParticipantId = match.userId === messageData.senderId ? match.matchedUserId : match.userId;
      if (await storage.isBlockedBetween(messageData.senderId, otherParticipantId)) {
        return res.status(403).json({ message: "User is blocked" });
      }

      const message = await storage.createMessage(messageData);
      
      // Create notification for new message
      try {
        const recipientId = match.userId === messageData.senderId ? match.matchedUserId : match.userId;
        await storage.createNotification({
          type: 'message',
          senderId: messageData.senderId,
          recipientId: recipientId,
          message: 'Hai ricevuto un nuovo messaggio!',
          relatedId: message.id,
          isRead: false
        });
      } catch (notificationError) {
        console.error("Error creating message notification:", notificationError);
        // Don't fail the message creation if notification fails
      }
      
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Notification API endpoints
  
  // Get notifications for current user
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const blocked = await getBlockedSet(req.session.userId);
      const notifications = (await storage.getNotificationsByUser(req.session.userId!))
        .filter((n) => !blocked.has(n.senderId));
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });
  
  // Get unread notification count for current user
  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const unreadCount = await storage.getUnreadNotificationCount(req.session.userId!);
      res.json({ count: unreadCount });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ message: "Failed to fetch unread notification count" });
    }
  });
  
  // Mark notification as read
  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      // First, verify the notification belongs to the current user
      const notifications = await storage.getNotificationsByUser(req.session.userId!);
      const userNotification = notifications.find(n => n.id === req.params.id);
      
      if (!userNotification) {
        return res.status(404).json({ message: "Notification not found or unauthorized" });
      }
      
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round((R * c) * 10) / 10; // Round to 1 decimal place
  };

  // Get nearby parks and playgrounds from Google Places API
  app.get("/api/places/nearby-parks", async (req, res) => {
    try {
      const { lat, lng, radius = "5000" } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      // Fetch parks and playgrounds from Google Places API
      const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=park|playground&key=${apiKey}`;
      
      const response = await fetch(placesUrl);
      const data = await response.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.error("Google Places API error:", data);
        return res.status(500).json({ message: "Failed to fetch places from Google" });
      }

      // Format results
      const places = (data.results || []).map((place: any) => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        rating: place.rating || 0,
        userRatingsTotal: place.user_ratings_total || 0,
        types: place.types,
        photoReference: place.photos?.[0]?.photo_reference,
        isOpen: place.opening_hours?.open_now
      }));

      res.json(places);
    } catch (error) {
      console.error("Error fetching nearby parks:", error);
      res.status(500).json({ message: "Failed to fetch nearby parks" });
    }
  });

  // Get nearby locations with distance calculation - returns only user-added locations
  app.get("/api/locations/nearby", async (req, res) => {
    try {
      const { category, lat, lng, limit = "10" } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }
      
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const maxResults = parseInt(limit as string);

      // Get only user-added locations from database
      let locations;
      if (category && typeof category === 'string' && category !== 'All') {
        locations = await storage.getLocationsByCategory(category);
      } else {
        locations = await storage.getAllLocations();
      }

      // Filter to only show approved locations (user-added or admin-uploaded)
      const approvedLocations = locations.filter(location => location.approved);

      // Calculate distances and add review counts for approved locations
      const locationsWithDistances = await Promise.all(
        approvedLocations.map(async (location) => {
          const [lat, lng] = location.coordinates.split(',').map(coord => parseFloat(coord.trim()));
          const distance = calculateDistance(userLat, userLng, lat, lng);
          
          const reviews = await storage.getReviewsByLocation(location.id);
          const reviewCount = reviews.length;
          const averageRating = reviewCount > 0 
            ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount) * 10) / 10
            : location.rating;
          
          return {
            ...location,
            distance,
            reviewCount,
            averageRating
          };
        })
      );

      // Sort by distance and limit results
      const sortedResults = locationsWithDistances
        .sort((a, b) => (a.distance || 0) - (b.distance || 0))
        .slice(0, maxResults);

      res.json(sortedResults);
    } catch (error) {
      console.error("Error fetching nearby locations:", error);
      res.status(500).json({ message: "Failed to fetch nearby locations" });
    }
  });

  // Get all locations (only user-added locations)
  app.get("/api/locations", async (req, res) => {
    try {
      const { category, province } = req.query;
      let locations;
      
      if (category && typeof category === 'string' && province && typeof province === 'string') {
        locations = await storage.getLocationsByCategoryAndProvince(category, province);
      } else if (category && typeof category === 'string') {
        locations = await storage.getLocationsByCategory(category);
      } else if (province && typeof province === 'string') {
        locations = await storage.getLocationsByProvince(province);
      } else {
        locations = await storage.getAllLocations();
      }

      // Filter to only show approved locations (user-added or admin-uploaded)
      const approvedLocations = locations.filter(location => location.approved);

      // Add review counts to each location
      const locationsWithReviews = await Promise.all(
        approvedLocations.map(async (location) => {
          const reviews = await storage.getReviewsByLocation(location.id);
          const reviewCount = reviews.length;
          const averageRating = reviewCount > 0 
            ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount) * 10) / 10
            : location.rating;
          
          return {
            ...location,
            reviewCount,
            averageRating
          };
        })
      );
      
      res.json(locationsWithReviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  // Get specific location
  app.get("/api/locations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const location = await storage.getLocation(id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });

  // Get reviews for a location
  app.get("/api/locations/:id/reviews", async (req, res) => {
    try {
      const { id } = req.params;
      let reviews = await storage.getReviewsByLocation(id);

      // Hide reviews written by blocked users
      const blocked = await getBlockedSet(req.session.userId);
      reviews = reviews.filter((r) => !blocked.has(r.userId));

      // Get profile information for review authors
      const reviewsWithProfiles = await Promise.all(
        reviews.map(async (review) => {
          const profile = await storage.getProfile(review.userId);
          return {
            ...review,
            profile: profile ? { name: `${profile.firstName} ${profile.lastName}`, photoUrl: profile.photoUrls[0] || '' } : null,
          };
        })
      );
      
      res.json(reviewsWithProfiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Create a review
  app.post("/api/reviews", requireAuth, async (req: any, res) => {
    try {
      const reviewData = insertReviewSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const review = await storage.createReview(reviewData);
      res.json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid review data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Create or get location from Google Place
  app.post("/api/locations/from-google-place", requireAuth, async (req, res) => {
    try {
      const { placeId, name, address, latitude, longitude } = req.body;
      
      if (!placeId || !name || !address || !latitude || !longitude) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if location with this Google Place ID already exists
      const existingLocations = await storage.getAllLocations();
      const existing = existingLocations.find(loc => loc.googlePlaceId === placeId);
      
      if (existing) {
        return res.json(existing);
      }

      // Create new location for this Google Place
      const locationData = {
        name,
        address,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        googlePlaceId: placeId,
        isGooglePlace: true,
        category: "Park", // Default category for parks/playgrounds
        province: "", // Can be extracted from address if needed
        description: "",
        imageUrl: "",
        rating: 0,
        amenities: [],
        ageGroups: [],
        coordinates: `${latitude}, ${longitude}`,
        openingHours: "",
        addedByUserId: req.session.userId,
        approved: true // Auto-approve Google Places
      };
      
      const location = await storage.createLocation(locationData);
      res.status(201).json(location);
    } catch (error) {
      console.error("Error creating location from Google Place:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  // Add a new location
  app.post("/api/locations", requireAuth, async (req, res) => {
    try {
      const locationData = insertLocationSchema.parse({
        ...req.body,
        addedByUserId: req.session.userId,
        isGooglePlace: false
      });
      
      const location = await storage.createLocation(locationData);
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid location data", errors: error.errors });
      }
      console.error("Error creating location:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  // Update subscription plan
  app.put("/api/users/:userId/subscription", async (req, res) => {
    try {
      const { userId } = req.params;
      const { plan } = req.body;
      
      if (!plan || !['free', 'pro'].includes(plan)) {
        return res.status(400).json({ message: "Invalid subscription plan" });
      }
      
      const updatedUser = await storage.updateUserSubscription(userId, { subscriptionStatus: plan === 'pro' ? 'active' : 'inactive' });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        message: `Subscription updated to ${plan}`,
        user: updatedUser 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });


  // Update user activity (keep them online)
  app.post("/api/users/:userId/activity", async (req, res) => {
    try {
      const { userId } = req.params;
      if (storage.updateUserActivity) {
        await storage.updateUserActivity(userId);
      }
      res.json({ message: "Activity updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  // Update user language preference
  app.patch("/api/users/update-language", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { language } = req.body;
      if (!language || !['en', 'it'].includes(language)) {
        return res.status(400).json({ message: "Invalid language" });
      }

      if (storage.updateUserLanguage) {
        await storage.updateUserLanguage(userId, language);
      }
      
      res.json({ message: "Language updated successfully", language });
    } catch (error) {
      console.error("Error updating language:", error);
      res.status(500).json({ message: "Failed to update language" });
    }
  });

  // Marketplace routes
  app.get("/api/marketplace/items", async (req, res) => {
    try {
      const { category } = req.query;
      let items: any[] = [];
      if (category && typeof category === 'string') {
        items = await storage.getMarketplaceItemsByCategory(category);
      } else {
        if (storage.getAllMarketplaceItems) {
          items = await storage.getAllMarketplaceItems();
        } else {
          items = [];
        }
      }

      // Hide listings from blocked sellers
      const blocked = await getBlockedSet(req.session.userId);
      items = items.filter((item) => !blocked.has(item.sellerId));

      // Fetch seller profiles for each item
      const itemsWithSellerProfiles = await Promise.all(
        items.map(async (item) => {
          const sellerProfile = await storage.getProfile(item.sellerId);
          return {
            ...normalizeItemImages(req, item),
            sellerProfile: normalizeProfileImages(req, sellerProfile ?? null)
          };
        })
      );

      res.json(itemsWithSellerProfiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch marketplace items" });
    }
  });

  app.get("/api/marketplace/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.getMarketplaceItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(normalizeItemImages(req, item));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch marketplace item" });
    }
  });

  // Temporary route to fix existing marketplace images ACL
  app.post("/api/fix-marketplace-images", requireAuth, async (req: any, res) => {
    try {
      const items = await storage.getAllMarketplaceItems();
      let fixedCount = 0;
      
      for (const item of items) {
        if (item.imageUrls && Array.isArray(item.imageUrls)) {
          for (const imageUrl of item.imageUrls) {
            try {
              await objectStorageService.trySetObjectEntityAclPolicy(imageUrl, {
                owner: item.sellerId,
                visibility: "public"
              });
              console.log(`[FIX] Set image as public: ${imageUrl}`);
              fixedCount++;
            } catch (aclError) {
              console.error(`[FIX] Failed to set ACL for image ${imageUrl}:`, aclError);
            }
          }
        }
      }
      
      res.json({ message: `Fixed ${fixedCount} images` });
    } catch (error) {
      console.error('Error fixing marketplace images:', error);
      res.status(500).json({ message: "Failed to fix images" });
    }
  });

  app.post("/api/marketplace/items", requireAuth, async (req, res) => {
    try {
      const itemData = { ...req.body, sellerId: req.session.userId };
      const item = await storage.createMarketplaceItem(itemData);
      
      // Set ACL policy for marketplace images to make them publicly readable
      if (itemData.imageUrls && Array.isArray(itemData.imageUrls) && req.session.userId) {
        for (const imageUrl of itemData.imageUrls) {
          try {
            await objectStorageService.trySetObjectEntityAclPolicy(imageUrl, {
              owner: req.session.userId,
              visibility: "public" // Marketplace images should be public
            });
            console.log(`[MARKETPLACE] Set image as public: ${imageUrl}`);
          } catch (aclError) {
            console.error(`[MARKETPLACE] Failed to set ACL for image ${imageUrl}:`, aclError);
          }
        }
      }
      
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating marketplace item:', error);
      res.status(500).json({ message: "Failed to create marketplace item" });
    }
  });

  app.put("/api/marketplace/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.updateMarketplaceItem(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update marketplace item" });
    }
  });

  app.patch("/api/marketplace/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.updateMarketplaceItem(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update marketplace item" });
    }
  });

  // Saved items API routes
  app.post("/api/marketplace/saved-items", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { itemId } = req.body;
      if (!itemId) {
        return res.status(400).json({ message: "Item ID is required" });
      }
      const savedItem = await storage.saveItem(req.session.userId, itemId);
      res.status(201).json(savedItem);
    } catch (error) {
      console.error('Error saving item:', error);
      res.status(500).json({ message: "Failed to save item" });
    }
  });

  app.delete("/api/marketplace/saved-items/:itemId", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { itemId } = req.params;
      await storage.unsaveItem(req.session.userId, itemId);
      res.json({ message: "Item unsaved successfully" });
    } catch (error) {
      console.error('Error unsaving item:', error);
      res.status(500).json({ message: "Failed to unsave item" });
    }
  });

  app.get("/api/marketplace/saved-items", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const savedItems = await storage.getSavedItems(req.session.userId);
      res.json(savedItems.map((it) => normalizeItemImages(req, it)));
    } catch (error) {
      console.error('Error getting saved items:', error);
      res.status(500).json({ message: "Failed to get saved items" });
    }
  });

  app.get("/api/marketplace/saved-items/:itemId/check", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { itemId } = req.params;
      const isSaved = await storage.isSavedItem(req.session.userId, itemId);
      res.json({ isSaved });
    } catch (error) {
      console.error('Error checking saved item:', error);
      res.status(500).json({ message: "Failed to check saved item" });
    }
  });

  app.delete("/api/marketplace/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMarketplaceItem(id);
      res.json({ message: "Item deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete marketplace item" });
    }
  });

  app.get("/api/marketplace/sellers/:sellerId/items", async (req, res) => {
    try {
      const { sellerId } = req.params;
      const items = await storage.getMarketplaceItemsBySeller(sellerId);
      res.json(items.map((it) => normalizeItemImages(req, it)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seller's items" });
    }
  });

  // Looking For Posts API routes
  app.get("/api/marketplace/looking-for", async (req, res) => {
    try {
      const { category } = req.query;
      let posts = category && typeof category === 'string'
        ? await storage.getLookingForPostsByType(category)
        : await storage.getAllLookingForPosts();
      // Hide posts from blocked users
      const blocked = await getBlockedSet(req.session.userId);
      posts = posts.filter((p) => !blocked.has(p.userId));
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch looking for posts" });
    }
  });

  app.post("/api/marketplace/looking-for", requireAuth, async (req: any, res) => {
    try {
      const postData = insertLookingForPostSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const post = await storage.createLookingForPost(postData);
      res.status(201).json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid post data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create looking for post" });
      }
    }
  });

  app.get("/api/marketplace/looking-for/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const post = await storage.getLookingForPost(id);
      if (!post) {
        return res.status(404).json({ message: "Looking for post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch looking for post" });
    }
  });

  app.put("/api/marketplace/looking-for/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const post = await storage.updateLookingForPost(id, updateData);
      if (!post) {
        return res.status(404).json({ message: "Looking for post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to update looking for post" });
    }
  });

  app.delete("/api/marketplace/looking-for/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLookingForPost(id);
      res.json({ message: "Looking for post deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete looking for post" });
    }
  });

  // Services API routes
  app.get("/api/services", async (req, res) => {
    try {
      const { serviceType } = req.query;
      let services = serviceType && typeof serviceType === 'string'
        ? await storage.getServicesByType(serviceType)
        : await storage.getAllServices();
      // Hide services from blocked providers
      const blocked = await getBlockedSet(req.session.userId);
      services = services.filter((s) => !blocked.has(s.providerId));
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  // The provider is ALWAYS the logged-in user. The form intentionally omits
  // providerId, so parsing the raw body used to fail validation every time —
  // that's why services could never be published.
  app.post("/api/services", requireAuth, async (req: any, res) => {
    try {
      const serviceData = insertServiceSchema.parse({
        ...req.body,
        providerId: req.session.userId,
      });
      const service = await storage.createService(serviceData);
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid service data", errors: error.errors });
      } else {
        console.error("Create service error:", error);
        res.status(500).json({ message: "Failed to create service" });
      }
    }
  });

  app.get("/api/services/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const service = await storage.getService(id);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service" });
    }
  });

  app.put("/api/services/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getService(id);
      if (!existing) {
        return res.status(404).json({ message: "Service not found" });
      }
      const user = await storage.getUserById(req.session.userId);
      if (existing.providerId !== req.session.userId && !isUserAdmin(user)) {
        return res.status(403).json({ message: "Not your service" });
      }
      const { providerId: _ignored, ...updateData } = req.body || {};
      const service = await storage.updateService(id, updateData);
      res.json(service);
    } catch (error) {
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getService(id);
      if (!existing) {
        return res.status(404).json({ message: "Service not found" });
      }
      const user = await storage.getUserById(req.session.userId);
      if (existing.providerId !== req.session.userId && !isUserAdmin(user)) {
        return res.status(403).json({ message: "Not your service" });
      }
      await storage.deleteService(id);
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  app.get("/api/services/provider/:providerId", async (req, res) => {
    try {
      const { providerId } = req.params;
      const services = await storage.getServicesByProvider(providerId);
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch provider's services" });
    }
  });

  // Service Looking For Posts API routes
  app.get("/api/services/looking-for", async (req, res) => {
    try {
      const { serviceType } = req.query;
      let posts = serviceType && typeof serviceType === 'string'
        ? await storage.getServiceLookingForPostsByType(serviceType)
        : await storage.getAllServiceLookingForPosts();
      // Hide posts from blocked users
      const blocked = await getBlockedSet(req.session.userId);
      posts = posts.filter((p) => !blocked.has(p.userId));
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service looking for posts" });
    }
  });

  app.post("/api/services/looking-for", requireAuth, async (req: any, res) => {
    try {
      const postData = insertServiceLookingForPostSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const post = await storage.createServiceLookingForPost(postData);
      res.status(201).json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid service looking for post data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create service looking for post" });
      }
    }
  });

  app.get("/api/services/looking-for/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const post = await storage.getServiceLookingForPost(id);
      if (!post) {
        return res.status(404).json({ message: "Service looking for post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service looking for post" });
    }
  });

  app.put("/api/services/looking-for/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const post = await storage.updateServiceLookingForPost(id, updateData);
      if (!post) {
        return res.status(404).json({ message: "Service looking for post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to update service looking for post" });
    }
  });

  app.delete("/api/services/looking-for/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteServiceLookingForPost(id);
      res.json({ message: "Service looking for post deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete service looking for post" });
    }
  });

  // ===== Community events =====

  // Events visible to the current user: own events (any status, so the
  // creator always sees pending/rejected states), approved public events, and
  // approved private events from accepted connections.
  app.get("/api/events", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const [allEvents, blocked, myMatches] = await Promise.all([
        storage.getAllEvents(),
        getBlockedSet(userId),
        storage.getMatchesByUser(userId),
      ]);
      const connectedIds = new Set(
        myMatches
          .filter((m) => m.isMatch)
          .map((m) => (m.userId === userId ? m.matchedUserId : m.userId)),
      );

      const visible = allEvents.filter((e) => {
        if (e.createdByUserId === userId) return true;
        if (blocked.has(e.createdByUserId)) return false;
        if (e.status !== "approved") return false;
        if (e.visibility === "private") return connectedIds.has(e.createdByUserId);
        return true;
      });

      const withCreator = await Promise.all(
        visible.map(async (e) => {
          const creator = await storage.getProfile(e.createdByUserId);
          return {
            ...e,
            isOwn: e.createdByUserId === userId,
            creatorName: creator
              ? (creator.businessName || `${creator.firstName} ${creator.lastName}`.trim())
              : "",
            creatorPhotoUrl: normalizeImageUrl(req, creator?.photoUrls?.[0] ?? null),
          };
        }),
      );
      res.json(withCreator);
    } catch (error) {
      console.error("Events list error:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Create an event. Admin events go live immediately; everyone else's wait
  // for admin approval.
  app.post("/api/events", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.session.userId);
      const eventData = insertEventSchema.parse({
        ...req.body,
        createdByUserId: req.session.userId,
      });
      const event = await storage.createEvent({
        ...eventData,
        status: isUserAdmin(user) ? "approved" : "pending",
      });

      // Let admins know there's an event waiting for moderation.
      // Fire-and-forget: the email must not delay the response.
      if (!isUserAdmin(user)) {
        (async () => {
          const creator = await describeUser(req.session.userId);
          await notifyAdminsOfReport("Nuovo evento in attesa di approvazione", [
            `Creato da: ${creator}`,
            `Titolo: ${event.title}`,
            `Data: ${new Date(event.eventDate).toLocaleString("it-IT")}`,
            `Luogo: ${event.location}`,
            `Visibilità: ${event.visibility === "private" ? "privato (solo connessioni)" : "pubblico"}`,
          ]);
        })().catch((err) => console.error("Event admin notification failed:", err));
      }
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      console.error("Create event error:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  // Delete an event (creator or admin)
  app.delete("/api/events/:id", requireAuth, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      const user = await storage.getUserById(req.session.userId);
      if (event.createdByUserId !== req.session.userId && !isUserAdmin(user)) {
        return res.status(403).json({ message: "Not your event" });
      }
      await storage.deleteEvent(req.params.id);
      res.json({ message: "Evento eliminato" });
    } catch (error) {
      console.error("Delete event error:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Admin: full events list for moderation
  app.get("/api/admin/events", requireAdmin, async (req: any, res) => {
    try {
      const [allEvents, allProfiles] = await Promise.all([
        storage.getAllEvents(),
        storage.getAllProfiles(),
      ]);
      res.json(allEvents.map((e) => {
        const creator = allProfiles.find((p) => p.userId === e.createdByUserId);
        return {
          ...e,
          creatorName: creator
            ? (creator.businessName || `${creator.firstName} ${creator.lastName}`.trim())
            : "—",
        };
      }));
    } catch (error) {
      console.error("Admin events error:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Admin: approve/reject an event (creator is notified in-app)
  app.patch("/api/admin/events/:id", requireAdmin, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (status !== "approved" && status !== "rejected" && status !== "pending") {
        return res.status(400).json({ message: "status must be 'approved', 'rejected' or 'pending'" });
      }
      const event = await storage.updateEventStatus(req.params.id, status);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (status !== "pending") {
        try {
          await storage.createNotification({
            type: "event",
            senderId: req.session.userId,
            recipientId: event.createdByUserId,
            message: status === "approved"
              ? `Il tuo evento "${event.title}" è stato approvato!`
              : `Il tuo evento "${event.title}" è stato rifiutato.`,
            relatedId: event.id,
            isRead: false,
          });
        } catch (notificationError) {
          console.error("Event status notification error:", notificationError);
        }
      }
      res.json(event);
    } catch (error) {
      console.error("Admin event update error:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // Admin routes
  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/api/admin/upload-csv", requireAdmin, upload.single('csv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      const category = req.body.category;
      if (!category) {
        return res.status(400).json({ message: "Category is required" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const records = parse(csvContent, {
        skip_empty_lines: true,
        trim: true,
      });

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        
        // Skip empty rows
        if (!row || row.length === 0) continue;

        try {
          const [nome, indirizzo, descrizione, linkGoogleMaps] = row;

          if (!nome || !indirizzo || !descrizione) {
            results.failed++;
            results.errors.push(`Riga ${i + 1}: Campi mancanti (nome, indirizzo, descrizione obbligatori)`);
            continue;
          }

          // Geocode the address
          let coordinates = "";
          let latitude = "";
          let longitude = "";
          let provincia = "";
          
          try {
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(indirizzo)}&key=${GOOGLE_MAPS_API_KEY}`;
            const geocodeResponse = await fetch(geocodeUrl);
            const geocodeData = await geocodeResponse.json();

            if (geocodeData.status === "OK" && geocodeData.results.length > 0) {
              const location = geocodeData.results[0].geometry.location;
              latitude = location.lat.toString();
              longitude = location.lng.toString();
              coordinates = `${latitude},${longitude}`;
              
              // Extract province from address_components
              const addressComponents = geocodeData.results[0].address_components;
              const provinceComponent = addressComponents.find((component: any) => 
                component.types.includes("administrative_area_level_3") || 
                component.types.includes("locality")
              );
              provincia = provinceComponent?.long_name || "";
            } else {
              results.failed++;
              results.errors.push(`Riga ${i + 1}: Impossibile geocodificare l'indirizzo "${indirizzo}"`);
              continue;
            }
          } catch (geocodeError) {
            console.error(`Geocoding error for row ${i + 1}:`, geocodeError);
            results.failed++;
            results.errors.push(`Riga ${i + 1}: Errore nel geocoding`);
            continue;
          }

          // Create location
          const locationData = {
            name: nome.trim(),
            category: category, // Use category from form
            address: indirizzo.trim(),
            province: provincia,
            description: descrizione.trim(),
            imageUrl: "https://via.placeholder.com/300x200?text=Location",
            amenities: [],
            ageGroups: ["Tutte le età"],
            coordinates: coordinates,
            openingHours: "Contattare per informazioni",
            googleMapsUrl: linkGoogleMaps?.trim() || undefined,
            approved: true, // Admin uploaded, auto-approve
            isGooglePlace: false,
          };

          await storage.createLocation(locationData);
          results.success++;
        } catch (rowError: any) {
          console.error(`Error processing row ${i + 1}:`, rowError);
          results.failed++;
          results.errors.push(`Riga ${i + 1}: ${rowError.message || 'Errore sconosciuto'}`);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("CSV upload error:", error);
      res.status(500).json({ message: "Failed to process CSV" });
    }
  });

  // ===== Marketplace chat endpoints =====
  // Conversations are keyed by an item reference. Besides real marketplace
  // items, a reference of the form "service:<serviceId>" opens a chat about a
  // service — this is how moms contact professionals without a connection.
  const SERVICE_REF_PREFIX = "service:";

  const resolveChatSubject = async (itemRef: string): Promise<
    | { kind: "item"; sellerId: string; item: MarketplaceItem }
    | { kind: "service"; sellerId: string; service: any }
    | null
  > => {
    if (itemRef.startsWith(SERVICE_REF_PREFIX)) {
      const service = await storage.getService(itemRef.slice(SERVICE_REF_PREFIX.length));
      return service ? { kind: "service", sellerId: service.providerId, service } : null;
    }
    const item = await storage.getMarketplaceItem(itemRef);
    return item ? { kind: "item", sellerId: item.sellerId, item } : null;
  };

  // List the user's marketplace conversations (grouped by item + other user)
  app.get("/api/marketplace/conversations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const blocked = await getBlockedSet(userId);
      const msgs = await storage.getMarketplaceMessagesByUser(userId);

      // Group by item + counterpart; messages are ordered ASC so the last
      // one seen per key is the latest.
      const grouped = new Map<string, { itemId: string; otherUserId: string; lastMessage: any; messageCount: number }>();
      for (const m of msgs) {
        const otherUserId = m.buyerId === userId ? m.sellerId : m.buyerId;
        if (blocked.has(otherUserId)) continue; // hide blocked users' conversations
        const key = `${m.itemId}:${otherUserId}`;
        const existing = grouped.get(key);
        grouped.set(key, {
          itemId: m.itemId,
          otherUserId,
          lastMessage: m,
          messageCount: (existing?.messageCount ?? 0) + 1,
        });
      }

      const conversations = await Promise.all(
        Array.from(grouped.values()).map(async (c) => {
          const [subject, otherProfile] = await Promise.all([
            resolveChatSubject(c.itemId),
            storage.getProfile(c.otherUserId),
          ]);
          return {
            ...c,
            item: subject?.kind === "item" ? normalizeItemImages(req, subject.item) : null,
            service: subject?.kind === "service" ? subject.service : null,
            otherProfile: normalizeProfileImages(req, otherProfile ?? null),
          };
        }),
      );

      conversations.sort(
        (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
      );
      res.json(conversations);
    } catch (error) {
      console.error("Marketplace conversations error:", error);
      res.status(500).json({ message: "Failed to fetch marketplace conversations" });
    }
  });

  // Thread between the current user and another user about an item
  app.get("/api/marketplace/messages/:itemId/:otherUserId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { itemId, otherUserId } = req.params;
      const all = await storage.getMarketplaceMessagesByItem(itemId);
      const thread = all
        .filter(
          (m) =>
            (m.buyerId === userId && m.sellerId === otherUserId) ||
            (m.buyerId === otherUserId && m.sellerId === userId),
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const [subject, otherProfile] = await Promise.all([
        resolveChatSubject(itemId),
        storage.getProfile(otherUserId),
      ]);
      res.json({
        item: subject?.kind === "item" ? normalizeItemImages(req, subject.item) : null,
        service: subject?.kind === "service" ? subject.service : null,
        otherProfile: normalizeProfileImages(req, otherProfile ?? null),
        messages: thread,
      });
    } catch (error) {
      console.error("Marketplace thread error:", error);
      res.status(500).json({ message: "Failed to fetch marketplace messages" });
    }
  });

  // Send a marketplace message
  app.post("/api/marketplace/messages", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { itemId, otherUserId, content } = req.body;
      if (!itemId || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ message: "itemId and content are required" });
      }

      const subject = await resolveChatSubject(itemId);
      if (!subject) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Blocked users can't message each other
      const counterpartId = userId === subject.sellerId ? otherUserId : subject.sellerId;
      if (counterpartId && await storage.isBlockedBetween(userId, counterpartId)) {
        return res.status(403).json({ message: "User is blocked" });
      }

      // The seller is fixed by the item/service; the buyer is whoever isn't the seller.
      const sellerId = subject.sellerId;
      const buyerId = userId === sellerId ? otherUserId : userId;
      if (!buyerId) {
        return res.status(400).json({ message: "otherUserId is required when replying as the seller" });
      }
      if (userId !== sellerId && userId !== buyerId) {
        return res.status(403).json({ message: "Not part of this conversation" });
      }

      const message = await storage.createMarketplaceMessage({
        itemId,
        buyerId,
        sellerId,
        senderId: userId,
        content: content.trim(),
      });
      res.status(201).json(message);
    } catch (error) {
      console.error("Marketplace send message error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // ===== Admin management endpoints =====

  // Dashboard stats
  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const [allUsers, allProfiles, allLocations, allItems, allServices, allReports, allEvents] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllProfiles(),
        storage.getAllLocations(),
        storage.getAllMarketplaceItems(),
        storage.getAllServices(),
        storage.getAllReports(),
        storage.getAllEvents(),
      ]);
      res.json({
        users: allUsers.length,
        verifiedUsers: allUsers.filter((u) => u.isEmailVerified).length,
        subscribedUsers: allUsers.filter((u) => u.subscriptionStatus === "active").length,
        profiles: allProfiles.length,
        testProfiles: allProfiles.filter((p) => p.isTestProfile).length,
        professionals: allProfiles.filter((p) => p.accountType === "professional").length,
        locations: allLocations.length,
        pendingLocations: allLocations.filter((l) => !l.approved).length,
        marketplaceItems: allItems.length,
        services: allServices.length,
        openReports: allReports.filter((r) => r.status === "open").length,
        events: allEvents.length,
        pendingEvents: allEvents.filter((e) => e.status === "pending").length,
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Users + profiles list
  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      const [allUsers, allProfiles] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllProfiles(),
      ]);
      const result = allUsers.map((u) => {
        const profile = allProfiles.find((p) => p.userId === u.id);
        return {
          id: u.id,
          email: u.email,
          isEmailVerified: u.isEmailVerified,
          subscriptionStatus: u.subscriptionStatus,
          isAdmin: isUserAdmin(u),
          // env-bootstrapped admins can't be demoted from the dashboard
          isEnvAdmin: isAdminEmail(u.email),
          profile: profile
            ? {
                id: profile.id,
                firstName: profile.firstName,
                lastName: profile.lastName,
                location: profile.location,
                isTestProfile: profile.isTestProfile,
                createdAt: profile.createdAt,
              }
            : null,
        };
      });
      res.json(result);
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Toggle test flag on a profile
  app.patch("/api/admin/profiles/:profileId/test", requireAdmin, async (req, res) => {
    try {
      const { isTestProfile } = req.body;
      if (typeof isTestProfile !== "boolean") {
        return res.status(400).json({ message: "isTestProfile boolean is required" });
      }
      const profile = await storage.setProfileTestFlag(req.params.profileId, isTestProfile);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Admin test flag error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Mark every existing profile as test
  app.post("/api/admin/profiles/mark-all-test", requireAdmin, async (_req, res) => {
    try {
      const count = await storage.markAllProfilesAsTest();
      res.json({ message: `${count} profili marcati come test`, count });
    } catch (error) {
      console.error("Admin mark-all-test error:", error);
      res.status(500).json({ message: "Failed to mark profiles" });
    }
  });

  // Bulk set/unset the test flag on all profiles
  app.post("/api/admin/profiles/set-all-test", requireAdmin, async (req, res) => {
    try {
      const { isTest } = req.body;
      if (typeof isTest !== "boolean") {
        return res.status(400).json({ message: "isTest boolean is required" });
      }
      const count = await storage.setAllProfilesTest(isTest);
      res.json({
        message: isTest ? `${count} profili marcati come test` : `${count} profili rimossi dai test`,
        count,
      });
    } catch (error) {
      console.error("Admin set-all-test error:", error);
      res.status(500).json({ message: "Failed to update profiles" });
    }
  });

  // Marketplace items management
  app.get("/api/admin/marketplace", requireAdmin, async (_req, res) => {
    try {
      const [items, profiles] = await Promise.all([
        storage.getAllMarketplaceItems(),
        storage.getAllProfiles(),
      ]);
      const result = items.map((it) => {
        const seller = profiles.find((p) => p.userId === it.sellerId);
        return {
          id: it.id,
          title: it.title,
          price: it.price,
          category: it.category,
          condition: it.condition,
          createdAt: it.createdAt,
          sellerName: seller ? `${seller.firstName} ${seller.lastName}`.trim() : "—",
        };
      });
      res.json(result);
    } catch (error) {
      console.error("Admin marketplace list error:", error);
      res.status(500).json({ message: "Failed to fetch marketplace items" });
    }
  });

  app.delete("/api/admin/marketplace/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteMarketplaceItem(req.params.id);
      res.json({ message: "Annuncio eliminato" });
    } catch (error) {
      console.error("Admin marketplace delete error:", error);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Services management
  app.get("/api/admin/services", requireAdmin, async (_req, res) => {
    try {
      const [services, profiles] = await Promise.all([
        storage.getAllServices(),
        storage.getAllProfiles(),
      ]);
      const result = services.map((s) => {
        const provider = profiles.find((p) => p.userId === s.providerId);
        return {
          id: s.id,
          title: s.title,
          serviceType: s.serviceType,
          hourlyRate: s.hourlyRate,
          location: s.location,
          isAvailable: s.isAvailable,
          createdAt: s.createdAt,
          providerName: provider ? `${provider.firstName} ${provider.lastName}`.trim() : "—",
        };
      });
      res.json(result);
    } catch (error) {
      console.error("Admin services list error:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.delete("/api/admin/services/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteService(req.params.id);
      res.json({ message: "Servizio eliminato" });
    } catch (error) {
      console.error("Admin service delete error:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // Reports moderation (App Store 1.2)
  app.get("/api/admin/reports", requireAdmin, async (_req, res) => {
    try {
      const [allReports, allProfiles, allUsers] = await Promise.all([
        storage.getAllReports(),
        storage.getAllProfiles(),
        storage.getAllUsers(),
      ]);
      const label = (userId: string | null) => {
        if (!userId) return "—";
        const profile = allProfiles.find((p) => p.userId === userId);
        const user = allUsers.find((u) => u.id === userId);
        const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
        return name || user?.email || userId;
      };
      res.json(allReports.map((r) => ({
        ...r,
        reporterName: label(r.reporterId),
        reportedUserName: label(r.reportedUserId),
      })));
    } catch (error) {
      console.error("Admin reports list error:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.patch("/api/admin/reports/:id", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (status !== "open" && status !== "resolved") {
        return res.status(400).json({ message: "status must be 'open' or 'resolved'" });
      }
      const report = await storage.updateReportStatus(req.params.id, status);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      res.json(report);
    } catch (error) {
      console.error("Admin report update error:", error);
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  // Promote/demote a user as admin
  app.patch("/api/admin/users/:userId/admin", requireAdmin, async (req: any, res) => {
    try {
      const { isAdmin } = req.body;
      if (typeof isAdmin !== "boolean") {
        return res.status(400).json({ message: "isAdmin boolean is required" });
      }
      const target = await storage.getUserById(req.params.userId);
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }
      if (isAdminEmail(target.email)) {
        return res.status(400).json({ message: "Questo admin è definito via ADMIN_EMAILS e non si gestisce da qui" });
      }
      if (!isAdmin && req.params.userId === req.session.userId) {
        return res.status(400).json({ message: "Non puoi rimuovere l'admin a te stesso" });
      }
      const updated = await storage.setUserAdmin(req.params.userId, isAdmin);
      res.json({ id: updated?.id, isAdmin: isUserAdmin(updated) });
    } catch (error) {
      console.error("Admin promote error:", error);
      res.status(500).json({ message: "Failed to update admin" });
    }
  });

  // Add an admin by email (must be an existing registered user)
  app.post("/api/admin/admins", requireAdmin, async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email) {
        return res.status(400).json({ message: "email is required" });
      }
      const target = await storage.getUserByEmail(email);
      if (!target) {
        return res.status(404).json({ message: "Nessun utente registrato con questa email" });
      }
      const updated = await storage.setUserAdmin(target.id, true);
      res.json({ id: updated?.id, email: updated?.email, isAdmin: isUserAdmin(updated) });
    } catch (error) {
      console.error("Admin add error:", error);
      res.status(500).json({ message: "Failed to add admin" });
    }
  });

  // Delete a user (and their profile)
  app.delete("/api/admin/users/:userId", requireAdmin, async (req: any, res) => {
    try {
      if (req.params.userId === req.session.userId) {
        return res.status(400).json({ message: "Non puoi eliminare il tuo account admin" });
      }
      await storage.deleteUserCompletely(req.params.userId);
      res.json({ message: "Utente eliminato" });
    } catch (error) {
      console.error("Admin delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // App settings
  app.get("/api/admin/settings", requireAdmin, async (_req, res) => {
    try {
      const showTestProfiles = (await storage.getSetting("showTestProfiles")) !== "false";
      res.json({ showTestProfiles });
    } catch (error) {
      console.error("Admin settings error:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const { showTestProfiles } = req.body;
      if (typeof showTestProfiles !== "boolean") {
        return res.status(400).json({ message: "showTestProfiles boolean is required" });
      }
      await storage.setSetting("showTestProfiles", String(showTestProfiles));
      res.json({ showTestProfiles });
    } catch (error) {
      console.error("Admin settings update error:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Locations management (includes unapproved)
  app.get("/api/admin/locations", requireAdmin, async (_req, res) => {
    try {
      const allLocations = await storage.getAllLocations();
      res.json(allLocations);
    } catch (error) {
      console.error("Admin locations error:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.patch("/api/admin/locations/:id", requireAdmin, async (req, res) => {
    try {
      const { approved } = req.body;
      if (typeof approved !== "boolean") {
        return res.status(400).json({ message: "approved boolean is required" });
      }
      const location = await storage.updateLocation(req.params.id, { approved });
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      console.error("Admin location update error:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete("/api/admin/locations/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteLocation(req.params.id);
      res.json({ message: "Luogo eliminato" });
    } catch (error) {
      console.error("Admin location delete error:", error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // Import parks from OpenStreetMap for a given city
  app.post("/api/admin/import-osm-parks", requireAdmin, async (req, res) => {
    try {
      const { city } = req.body;
      if (!city || typeof city !== "string" || !city.trim()) {
        return res.status(400).json({ message: "city is required" });
      }
      const result = await importOsmParks(city.trim());
      res.json(result);
    } catch (error: any) {
      console.error("OSM import error:", error);
      res.status(500).json({ message: `Import OSM fallito: ${error.message}` });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
