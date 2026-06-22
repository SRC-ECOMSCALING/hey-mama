import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSwipeSchema, insertMessageSchema, insertReviewSchema, insertLookingForPostSchema, insertServiceSchema, insertServiceLookingForPostSchema, insertLocationSchema, registrationSchema, loginSchema, updateProfileSchema } from "@shared/schema";
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
      
      res.json({
        id: user.id,
        email: user.email,
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

  // Public upload route for registration (no auth required)
  app.post("/api/objects/upload/public", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error creating upload URL:", error);
      res.status(500).json({ error: "Failed to create upload URL" });
    }
  });

  // Authenticated upload route for logged-in users
  app.post("/api/objects/upload", requireAuth, async (req: any, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error creating upload URL:", error);
      res.status(500).json({ error: "Failed to create upload URL" });
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

  // Get all profiles for discovery (requires active subscription)
  app.get("/api/profiles/discover/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      let profiles = await storage.getDiscoverableProfiles(userId);
      if (!(await shouldShowTestProfiles())) {
        profiles = profiles.filter((p) => !p.isTestProfile);
      }
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profiles" });
    }
  });

  // Get all profiles for map display (no limit, includes all profiles)
  app.get("/api/profiles/map", requireAuth, async (req, res) => {
    try {
      let allProfiles = await storage.getAllProfiles();
      if (!(await shouldShowTestProfiles())) {
        allProfiles = allProfiles.filter((p) => !p.isTestProfile);
      }
      res.json(allProfiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profiles" });
    }
  });

  // Get current user's own profile
  app.get("/api/profiles/current-user", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      // Auto-create a minimal profile for legacy accounts that never had one,
      // so the profile page works instead of dead-ending on "profilo non trovato".
      const profile = await storage.ensureProfile(userId);
      res.json(profile);
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
      res.json(profile);
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

  // Create a swipe (requires active subscription)
  app.post("/api/swipes", requireAuth, async (req, res) => {
    try {
      // Always use the authenticated user as the actor (ignore client "current-user").
      const parsed = insertSwipeSchema.parse(req.body);
      const swipeData = { ...parsed, userId: (req as any).session.userId };

      const swipe = await storage.createSwipe(swipeData);

      // Community model (not dating): connecting establishes a connection
      // immediately so both moms can message — no mutual "match" required.
      let match = null;
      if (swipeData.isLike) {
        const existing = await storage.getMatch(swipeData.userId, swipeData.targetUserId);
        match = existing || await storage.createMatch({
          userId: swipeData.userId,
          matchedUserId: swipeData.targetUserId,
          isMatch: true,
        });

        // Notify the other user that someone connected with them.
        if (!existing) {
          try {
            await storage.createNotification({
              type: 'match',
              senderId: swipeData.userId,
              recipientId: swipeData.targetUserId,
              message: 'Una mamma si è connessa con te!',
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
        connected: !!match,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid swipe data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create swipe" });
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
      
      // Get all matches for the user
      const allMatches = await storage.getMatchesByUser(userId);
      
      // Filter for mutual matches only (where both users liked each other)
      const mutualMatches = [];
      const processedPairs = new Set();
      
      for (const match of allMatches) {
        const otherUserId = match.userId === userId ? match.matchedUserId : match.userId;
        const pairKey = [userId, otherUserId].sort().join('-');
        
        if (!processedPairs.has(pairKey)) {
          processedPairs.add(pairKey);
          
          // Check if there's a mutual match (both users liked each other)
          const reverseMatch = await storage.getMatch(userId, otherUserId);
          const forwardMatch = await storage.getMatch(otherUserId, userId);
          
          if (reverseMatch && forwardMatch && reverseMatch.isMatch && forwardMatch.isMatch) {
            mutualMatches.push(match);
          }
        }
      }
      
      // Get profile information for matched users
      const matchesWithProfiles = await Promise.all(
        mutualMatches.map(async (match) => {
          const matchedUserId = match.userId === userId ? match.matchedUserId : match.userId;
          const profile = await storage.getProfile(matchedUserId);
          return {
            ...match,
            profile,
            matchedUserId, // Add this for easier access
          };
        })
      );
      
      res.json(matchesWithProfiles);
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
      
      // Find the match between current user and matched user
      const match = await storage.getMatch(req.session.userId, matchedUserId);
      
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      // Get the matched user's profile for conversation display
      const profile = await storage.getProfile(matchedUserId);
      
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
      
      const matches = await storage.getMatchesByUser(userId);
      
      // Only return matches that have messages (active conversations)
      const conversationsWithMessages = [];
      
      for (const match of matches) {
        const messages = await storage.getMessagesByMatch(match.id);
        if (messages.length > 0) {
          const otherUserId = match.userId === userId ? match.matchedUserId : match.userId;
          const profile = await storage.getProfile(otherUserId);
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
      
      const message = await storage.createMessage(messageData);
      
      // Create notification for new message
      try {
        const recipientId = match.userId === messageData.senderId ? match.matchedUserId : match.userId;
        await storage.createNotification({
          type: 'message',
          senderId: messageData.senderId,
          recipientId: recipientId,
          message: 'You have a new message!',
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
      const notifications = await storage.getNotificationsByUser(req.session.userId!);
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
      const reviews = await storage.getReviewsByLocation(id);
      
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
  app.post("/api/reviews", async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse(req.body);
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
      
      // Fetch seller profiles for each item
      const itemsWithSellerProfiles = await Promise.all(
        items.map(async (item) => {
          const sellerProfile = await storage.getProfile(item.sellerId);
          return {
            ...item,
            sellerProfile: sellerProfile || null
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
      res.json(item);
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
      res.json(savedItems);
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
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seller's items" });
    }
  });

  // Looking For Posts API routes
  app.get("/api/marketplace/looking-for", async (req, res) => {
    try {
      const { category } = req.query;
      if (category && typeof category === 'string') {
        const posts = await storage.getLookingForPostsByType(category);
        res.json(posts);
      } else {
        const posts = await storage.getAllLookingForPosts();
        res.json(posts);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch looking for posts" });
    }
  });

  app.post("/api/marketplace/looking-for", async (req, res) => {
    try {
      const postData = insertLookingForPostSchema.parse(req.body);
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
      if (serviceType && typeof serviceType === 'string') {
        const services = await storage.getServicesByType(serviceType);
        res.json(services);
      } else {
        const services = await storage.getAllServices();
        res.json(services);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.post("/api/services", async (req, res) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(serviceData);
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid service data", errors: error.errors });
      } else {
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

  app.put("/api/services/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const service = await storage.updateService(id, updateData);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", async (req, res) => {
    try {
      const { id } = req.params;
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
      if (serviceType && typeof serviceType === 'string') {
        const posts = await storage.getServiceLookingForPostsByType(serviceType);
        res.json(posts);
      } else {
        const posts = await storage.getAllServiceLookingForPosts();
        res.json(posts);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service looking for posts" });
    }
  });

  app.post("/api/services/looking-for", async (req, res) => {
    try {
      const postData = insertServiceLookingForPostSchema.parse(req.body);
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

  // List the user's marketplace conversations (grouped by item + other user)
  app.get("/api/marketplace/conversations", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const msgs = await storage.getMarketplaceMessagesByUser(userId);

      // Group by item + counterpart; messages are ordered ASC so the last
      // one seen per key is the latest.
      const grouped = new Map<string, { itemId: string; otherUserId: string; lastMessage: any; messageCount: number }>();
      for (const m of msgs) {
        const otherUserId = m.buyerId === userId ? m.sellerId : m.buyerId;
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
          const [item, otherProfile] = await Promise.all([
            storage.getMarketplaceItem(c.itemId),
            storage.getProfile(c.otherUserId),
          ]);
          return { ...c, item: item ?? null, otherProfile: otherProfile ?? null };
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

      const [item, otherProfile] = await Promise.all([
        storage.getMarketplaceItem(itemId),
        storage.getProfile(otherUserId),
      ]);
      res.json({ item: item ?? null, otherProfile: otherProfile ?? null, messages: thread });
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

      const item = await storage.getMarketplaceItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // The seller is fixed by the item; the buyer is whoever isn't the seller.
      const sellerId = item.sellerId;
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
      const [allUsers, allProfiles, allLocations, allItems, allServices] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllProfiles(),
        storage.getAllLocations(),
        storage.getAllMarketplaceItems(),
        storage.getAllServices(),
      ]);
      res.json({
        users: allUsers.length,
        verifiedUsers: allUsers.filter((u) => u.isEmailVerified).length,
        subscribedUsers: allUsers.filter((u) => u.subscriptionStatus === "active").length,
        profiles: allProfiles.length,
        testProfiles: allProfiles.filter((p) => p.isTestProfile).length,
        locations: allLocations.length,
        pendingLocations: allLocations.filter((l) => !l.approved).length,
        marketplaceItems: allItems.length,
        services: allServices.length,
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
