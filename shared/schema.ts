import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User authentication table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  passwordHash: varchar("password_hash").notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  emailVerificationCode: varchar("email_verification_code"),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  // Stripe subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status"), // active, canceled, past_due, etc.
  subscriptionEndDate: timestamp("subscription_end_date"),
  // User preferences
  language: varchar("language").default("en").notNull(), // 'en' or 'it'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Foreign key to users table
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  age: integer("age").notNull(),
  sex: varchar("sex").notNull(), // 'female', 'male', 'other'
  bio: text("bio").notNull(),
  location: text("location").notNull(),
  latitude: text("latitude"), // Geographic latitude
  longitude: text("longitude"), // Geographic longitude
  photoUrls: text("photo_urls").array().notNull(), // Multiple photos
  kidsNumber: integer("kids_number").notNull(),
  kidsAges: text("kids_ages").array().notNull(),
  kidsGenders: text("kids_genders").array(),
  hobbies: text("hobbies").array().notNull(), // Renamed from interests to match requirement
  vintedUrl: text("vinted_url"), // Vinted account URL
  distanceAway: text("distance_away").notNull(),
  dailySwipesUsed: integer("daily_swipes_used").default(0).notNull(),
  lastSwipeResetDate: text("last_swipe_reset_date").default("").notNull(),
  isOnline: boolean("is_online").default(false).notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  matchedUserId: varchar("matched_user_id").notNull(),
  isMatch: boolean("is_match").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const swipes = pgTable("swipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  targetUserId: varchar("target_user_id").notNull(),
  isLike: boolean("is_like").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  address: text("address").notNull(),
  province: text("province").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  rating: integer("rating").default(0).notNull(),
  amenities: text("amenities").array().notNull(),
  ageGroups: text("age_groups").array().notNull(),
  coordinates: text("coordinates").notNull(),
  openingHours: text("opening_hours").notNull(),
  googleMapsUrl: text("google_maps_url"),
  googlePlaceId: text("google_place_id"),
  isGooglePlace: boolean("is_google_place").default(false).notNull(),
  addedByUserId: varchar("added_by_user_id"), // Track which user added this location
  approved: boolean("approved").default(false).notNull(), // Admin approval required
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull(),
  userId: varchar("user_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  visitedWith: text("visited_with").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketplaceItems = pgTable("marketplace_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // Price in cents
  category: text("category").notNull(), // Hierarchical category (e.g., "Donna > Abbigliamento > Giacche")
  brand: text("brand").notNull(), // Brand name (e.g., "Nike", "Zara", "Senza marca")
  size: text("size").notNull(), // Size (e.g., "M", "38", "42 EU", "8 UK")
  condition: text("condition").notNull(), // "new-with-tags", "new-without-tags", "excellent", "good", "fair", "damaged"
  imageUrls: text("image_urls").array().notNull(), // At least 1, better 3-5 photos
  location: text("location").notNull(),
  vintedUrl: text("vinted_url"), // Individual Vinted listing URL for commission tracking
  negotiable: boolean("negotiable").default(false).notNull(), // Price negotiation enabled
  // Optional fields
  color: text("color"), // Product color
  material: text("material"), // Cotton, leather, etc.
  season: text("season"), // "Estivo", "Invernale", "Tutto l'anno"
  measurements: text("measurements"), // Non-standard measurements
  // Legacy field for baby items (keeping for backward compatibility)
  ageRange: text("age_range"),
  isAvailable: boolean("is_available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketplaceMessages = pgTable("marketplace_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").notNull(),
  buyerId: varchar("buyer_id").notNull(),
  sellerId: varchar("seller_id").notNull(),
  content: text("content").notNull(),
  senderId: varchar("sender_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // "match", "message"
  senderId: varchar("sender_id").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"), // ID of the match or message that triggered this notification
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true,
  dailySwipesUsed: true,
  lastSwipeResetDate: true,
  isOnline: true,
});

// Profile update schema - allows partial updates
export const updateProfileSchema = insertProfileSchema.partial().omit({
  userId: true, // User ID shouldn't be updatable
  distanceAway: true, // Distance is calculated, not user-editable
});

// Registration schema combining user and profile data
export const registrationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  age: z.number().min(18, "Must be at least 18 years old").max(100, "Must be under 100 years old"),
  sex: z.enum(["female", "male", "other"], { required_error: "Please select your sex" }),
  bio: z.string().min(10, "Bio must be at least 10 characters"),
  location: z.string().min(1, "Location is required"),
  photoUrls: z.array(z.string().url()).min(1, "At least one photo is required"),
  kidsNumber: z.number().min(0, "Number of kids cannot be negative"),
  kidsAges: z.array(z.string()),
  hobbies: z.array(z.string()).min(1, "At least one hobby is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const insertMarketplaceItemSchema = createInsertSchema(marketplaceItems).omit({
  id: true,
  createdAt: true,
});

export const insertMarketplaceMessageSchema = createInsertSchema(marketplaceMessages).omit({
  id: true,
  createdAt: true,
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertSwipeSchema = createInsertSchema(swipes).omit({
  id: true,
  createdAt: true,
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type Registration = z.infer<typeof registrationSchema>;
export type Login = z.infer<typeof loginSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Swipe = typeof swipes.$inferSelect;
export type InsertSwipe = z.infer<typeof insertSwipeSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type MarketplaceItem = typeof marketplaceItems.$inferSelect;
export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;

// Looking For Posts Schema
export const lookingForPosts = pgTable("looking_for_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category").notNull(),
  ageRange: varchar("age_range").notNull(),
  maxPrice: integer("max_price"), // in cents
  location: varchar("location").notNull(),
  urgency: varchar("urgency").notNull().default("normal"), // urgent, normal, flexible
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLookingForPostSchema = createInsertSchema(lookingForPosts).omit({
  id: true,
  createdAt: true,
});

export type LookingForPost = typeof lookingForPosts.$inferSelect;
export type InsertLookingForPost = z.infer<typeof insertLookingForPostSchema>;
export type MarketplaceMessage = typeof marketplaceMessages.$inferSelect;
export type InsertMarketplaceMessage = z.infer<typeof insertMarketplaceMessageSchema>;

// Services Schema
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  serviceType: varchar("service_type").notNull(), // babysitting, tutoring, cleaning, etc.
  hourlyRate: integer("hourly_rate"), // in cents per hour
  location: varchar("location").notNull(),
  availability: text("availability").notNull(), // flexible text field for availability
  experience: varchar("experience"), // years of experience
  certifications: text("certifications"), // relevant certifications/qualifications
  ageGroups: text("age_groups").notNull(), // comma-separated age ranges they work with
  isAvailable: boolean("is_available").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
});

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

// Service Looking For Posts Schema
export const serviceLookingForPosts = pgTable("service_looking_for_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  serviceType: varchar("service_type").notNull(), // babysitting, tutoring, cleaning, etc.
  maxHourlyRate: integer("max_hourly_rate"), // in cents per hour
  location: varchar("location").notNull(),
  schedule: text("schedule").notNull(), // when they need the service
  ageGroups: text("age_groups"), // age ranges they need service for
  urgency: varchar("urgency").notNull().default("normal"), // urgent, normal, flexible
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertServiceLookingForPostSchema = createInsertSchema(serviceLookingForPosts).omit({
  id: true,
  createdAt: true,
});

export type ServiceLookingForPost = typeof serviceLookingForPosts.$inferSelect;
export type InsertServiceLookingForPost = z.infer<typeof insertServiceLookingForPostSchema>;

// Saved Items Schema - for users to save marketplace items
export const savedItems = pgTable("saved_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  itemId: varchar("item_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSavedItemSchema = createInsertSchema(savedItems).omit({
  id: true,
  createdAt: true,
});

export type SavedItem = typeof savedItems.$inferSelect;
export type InsertSavedItem = z.infer<typeof insertSavedItemSchema>;

// Notification schema
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
