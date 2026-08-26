import { type User, type InsertUser, type Profile, type InsertProfile, type Match, type InsertMatch, type Message, type InsertMessage, type Swipe, type InsertSwipe, type Location, type InsertLocation, type Review, type InsertReview, type MarketplaceItem, type InsertMarketplaceItem, type MarketplaceMessage, type InsertMarketplaceMessage, type LookingForPost, type InsertLookingForPost, type Service, type InsertService, type ServiceLookingForPost, type InsertServiceLookingForPost, type SavedItem, type InsertSavedItem, type Notification, type InsertNotification, type Block, type Report, type InsertReport, type Event, type InsertEvent, type Registration, type Login } from "@shared/schema";
import bcrypt from "bcryptjs";
import { db, withDbRetry } from "./db";
import { eq, and, or, ne, notInArray, ilike, sql } from "drizzle-orm";
import {
  users,
  profiles,
  matches,
  messages,
  swipes,
  locations,
  reviews,
  marketplaceItems,
  marketplaceMessages,
  lookingForPosts,
  services,
  serviceLookingForPosts,
  savedItems,
  notifications,
  appSettings,
  blocks,
  reports,
  events,
} from "@shared/schema";

export interface IStorage {
  // Profile operations
  getProfile(id: string): Promise<Profile | undefined>;
  getAllProfiles(): Promise<Profile[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: string, profile: Partial<InsertProfile>): Promise<Profile | undefined>;

  // Swipe operations
  createSwipe(swipe: InsertSwipe): Promise<Swipe>;
  getSwipesByUser(userId: string): Promise<Swipe[]>;
  getSwipe(userId: string, targetUserId: string): Promise<Swipe | undefined>;

  // Match operations
  createMatch(match: InsertMatch): Promise<Match>;
  getMatchesByUser(userId: string): Promise<Match[]>;
  getMatch(userId: string, matchedUserId: string): Promise<Match | undefined>;
  getMatchById(matchId: string): Promise<Match | undefined>;

  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByMatch(matchId: string): Promise<Message[]>;

  // Discovery operations
  getDiscoverableProfiles(userId: string): Promise<Profile[]>;

  // Location operations
  getAllLocations(): Promise<Location[]>;
  getLocationsByCategory(category: string): Promise<Location[]>;
  getLocationsByProvince(province: string): Promise<Location[]>;
  getLocationsByCategoryAndProvince(category: string, province: string): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;

  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReviewsByLocation(locationId: string): Promise<Review[]>;
  getReviewsByUser(userId: string): Promise<Review[]>;

  // Online status operations
  updateUserActivity(userId: string): Promise<void>;
  updateOnlineStatus(userId: string, isOnline: boolean): Promise<void>;

  // Marketplace operations
  getAllMarketplaceItems(): Promise<MarketplaceItem[]>;
  getMarketplaceItemsByCategory(category: string): Promise<MarketplaceItem[]>;
  getMarketplaceItem(id: string): Promise<MarketplaceItem | undefined>;
  createMarketplaceItem(item: InsertMarketplaceItem): Promise<MarketplaceItem>;
  updateMarketplaceItem(id: string, item: Partial<InsertMarketplaceItem>): Promise<MarketplaceItem | undefined>;
  deleteMarketplaceItem(id: string): Promise<void>;
  getMarketplaceItemsBySeller(sellerId: string): Promise<MarketplaceItem[]>;

  // Marketplace message operations
  createMarketplaceMessage(message: InsertMarketplaceMessage): Promise<MarketplaceMessage>;
  getMarketplaceMessagesByItem(itemId: string): Promise<MarketplaceMessage[]>;

  // Saved items operations
  saveItem(userId: string, itemId: string): Promise<SavedItem>;
  unsaveItem(userId: string, itemId: string): Promise<void>;
  getSavedItems(userId: string): Promise<MarketplaceItem[]>;
  isSavedItem(userId: string, itemId: string): Promise<boolean>;

  // Looking For Post operations
  getAllLookingForPosts(): Promise<LookingForPost[]>;
  getLookingForPostsByCategory(category: string): Promise<LookingForPost[]>;
  getLookingForPost(id: string): Promise<LookingForPost | undefined>;
  createLookingForPost(post: InsertLookingForPost): Promise<LookingForPost>;
  updateLookingForPost(id: string, post: Partial<InsertLookingForPost>): Promise<LookingForPost | undefined>;
  deleteLookingForPost(id: string): Promise<void>;

  // Services operations
  getAllServices(): Promise<Service[]>;
  getServicesByType(serviceType: string): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<void>;
  getServicesByProvider(providerId: string): Promise<Service[]>;

  // Service Looking For Post operations
  getAllServiceLookingForPosts(): Promise<ServiceLookingForPost[]>;
  getServiceLookingForPostsByType(serviceType: string): Promise<ServiceLookingForPost[]>;
  getServiceLookingForPost(id: string): Promise<ServiceLookingForPost | undefined>;
  createServiceLookingForPost(post: InsertServiceLookingForPost): Promise<ServiceLookingForPost>;
  updateServiceLookingForPost(id: string, post: Partial<InsertServiceLookingForPost>): Promise<ServiceLookingForPost | undefined>;
  deleteServiceLookingForPost(id: string): Promise<void>;

  // Authentication operations
  createUser(userData: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  updateUserLanguage(userId: string, language: string): Promise<User | undefined>;
  updateUserSubscription(userId: string, subscriptionData: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionEndDate?: Date;
  }): Promise<User | undefined>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
  register(registrationData: Registration): Promise<{ user: User; profile: Profile }>;
  login(loginData: Login): Promise<User | null>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Block operations (App Store 1.2)
  blockUser(blockerId: string, blockedId: string): Promise<Block>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  getBlocksByUser(blockerId: string): Promise<Block[]>;
  getBlockedUserIds(userId: string): Promise<string[]>;
  isBlockedBetween(userIdA: string, userIdB: string): Promise<boolean>;

  // Report operations (App Store 1.2)
  createReport(report: InsertReport): Promise<Report>;
  getAllReports(): Promise<Report[]>;
  updateReportStatus(id: string, status: string): Promise<Report | undefined>;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  private db = db;

  constructor() {
    // Initialize with sample data if database is empty
    this.initializeDatabaseSampleData();
  }

  private async initializeDatabaseSampleData() {
    try {
      // Check if there are any profiles in the database
      const existingProfiles = await this.db.select().from(profiles).limit(1);
      if (existingProfiles.length > 0) {
        return; // Database already has data
      }

      // Insert sample users and profiles
      const sampleUsers = [
        { email: "sarah@example.com", passwordHash: await this.hashPassword("password123") },
        { email: "emma@example.com", passwordHash: await this.hashPassword("password123") },
        { email: "jessica@example.com", passwordHash: await this.hashPassword("password123") },
        { email: "maria@example.com", passwordHash: await this.hashPassword("password123") },
      ];

      const insertedUsers = await this.db.insert(users).values(sampleUsers).returning();

      const sampleProfiles = [
        {
          userId: insertedUsers[0].id,
          firstName: "Sarah", lastName: "Johnson", age: 32, sex: "female",
          bio: "Stay-at-home mom who loves organizing playdates in the park.",
          location: "Downtown Park Area",
          photoUrls: ["https://images.unsplash.com/photo-1559827260-dc66d52bef19?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
          kidsNumber: 2, kidsAges: ["2", "4"], kidsGenders: ["female", "male"], hobbies: ["Playground dates", "Coffee meetups"],
          distanceAway: "Milan"
        },
        {
          userId: insertedUsers[1].id,
          firstName: "Emma", lastName: "Wilson", age: 29, sex: "female",
          bio: "Working mom who loves weekend adventures with my little one.",
          location: "Central District",
          photoUrls: ["/attached_assets/Foto chiara_1754408450617.jpg"],
          kidsNumber: 1, kidsAges: ["3"], kidsGenders: ["female"], hobbies: ["Coffee meetups", "Weekend activities"],
          distanceAway: "Barcelona"
        },
        {
          userId: insertedUsers[2].id,
          firstName: "Jessica", lastName: "Brown", age: 28, sex: "female",
          bio: "First-time mom navigating this beautiful journey!",
          location: "Riverside Area",
          photoUrls: ["https://images.unsplash.com/photo-1544717297-fa95b6ee9643?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
          kidsNumber: 1, kidsAges: ["1"], kidsGenders: ["male"], hobbies: ["New mom support", "Baby activities"],
          distanceAway: "Paris"
        },
        {
          userId: insertedUsers[3].id,
          firstName: "Maria", lastName: "Garcia", age: 35, sex: "female",
          bio: "Bilingual mom raising trilingual kids!",
          location: "Cultural Quarter",
          photoUrls: ["https://images.unsplash.com/photo-1607746882042-944635dfe10e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
          kidsNumber: 2, kidsAges: ["5", "3"], kidsGenders: ["female", "female"], hobbies: ["Language learning", "Cultural activities"],
          distanceAway: "Rome"
        }
      ];

      await this.db.insert(profiles).values(sampleProfiles);

      // Insert sample locations including Italian locations
      const sampleLocations = [
        {
          id: "loc-1",
          name: "Sunny Ridge Park",
          category: "Park",
          address: "123 Oak Street, Downtown",
          province: "New York",
          description: "Beautiful family park with modern playground equipment, walking trails, and picnic areas. Perfect for toddlers and preschoolers with separate play areas for different age groups.",
          imageUrl: "https://images.unsplash.com/photo-1544737151144-6e4b998a4b60?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          rating: 5,
          amenities: ["Playground", "Picnic tables", "Walking trails", "Restrooms", "Parking"],
          ageGroups: ["0-2", "3-5"],
          coordinates: "40.7128,-74.0060",
          openingHours: "6:00 AM - 8:00 PM",
          isGooglePlace: false,
        },
        {
          id: "loc-2",
          name: "Parco San Lazzaro",
          category: "Park",
          address: "Via Milano, San Lazzaro di Savena, Bologna, Italy",
          province: "Bologna",
          description: "Beautiful park in San Lazzaro with playground areas, walking paths and green spaces perfect for families with young children.",
          imageUrl: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          rating: 4,
          amenities: ["Playground", "Walking paths", "Green spaces", "Benches"],
          ageGroups: ["0-2", "3-5"],
          coordinates: "44.4647,11.3426",
          openingHours: "7:00 AM - 9:00 PM",
          isGooglePlace: false,
        },
        {
          id: "loc-3",
          name: "Giardini Margherita Bologna",
          category: "Park",
          address: "Viale Gozzadini, Bologna, Italy",
          province: "Bologna",
          description: "Large historic park in Bologna with beautiful gardens, playgrounds, and family-friendly areas. Perfect for weekend outings with children.",
          imageUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          rating: 5,
          amenities: ["Playground", "Gardens", "Walking paths", "Cafe", "Restrooms"],
          ageGroups: ["0-2", "3-5"],
          coordinates: "44.4848,11.3501",
          openingHours: "6:00 AM - 10:00 PM",
          isGooglePlace: false,
        },
        {
          id: "loc-4",
          name: "Parco del Cavaticcio",
          category: "Playground",
          address: "Via del Cavaticcio, Bologna, Italy",
          province: "Bologna",
          description: "Modern playground with innovative play equipment, perfect for active toddlers and preschoolers. Features climbing structures and interactive play areas.",
          imageUrl: "https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          rating: 4,
          amenities: ["Playground", "Climbing structures", "Interactive play", "Shade areas"],
          ageGroups: ["2-5"],
          coordinates: "44.4944,11.3464",
          openingHours: "8:00 AM - 8:00 PM",
          isGooglePlace: false,
        },
        {
          id: "loc-5",
          name: "Adventure Playground",
          category: "Playground",
          address: "789 Pine Avenue, Riverside",
          province: "California",
          description: "Large adventure playground with climbing structures, swings, and sand play area. Ideal for active toddlers and young children.",
          imageUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          rating: 5,
          amenities: ["Climbing structures", "Swings", "Sandbox", "Shade areas", "Benches"],
          ageGroups: ["2-5"],
          coordinates: "40.7282,-73.7949",
          openingHours: "8:00 AM - 7:00 PM",
          isGooglePlace: false,
        },
        {
          id: "loc-6",
          name: "Caffè dei Bambini",
          category: "Cafe",
          address: "Piazza Aldrovandi, Bologna, Italy",
          province: "Bologna",
          description: "Family-friendly cafe with children's play area, high chairs, and kid-friendly menu. Perfect for coffee dates while children play safely.",
          imageUrl: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          rating: 4,
          amenities: ["Play area", "High chairs", "Kids menu", "Wifi", "Changing facilities"],
          ageGroups: ["0-2", "3-5"],
          coordinates: "44.4938,11.3387",
          openingHours: "7:00 AM - 7:00 PM",
          isGooglePlace: false,
        }
      ];

      await this.db.insert(locations).values(sampleLocations);
      console.log("Sample data initialized successfully with locations");
    } catch (error) {
      console.error("Error initializing sample data:", error);
    }
  }

  // User operations
  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await this.db.insert(users).values(userData).returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  // Grant/revoke admin from the dashboard.
  async setUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const [user] = await this.db.update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Record that the user accepted the Terms of Use + Privacy Policy.
  async setTermsAccepted(userId: string): Promise<User | undefined> {
    const [user] = await this.db.update(users)
      .set({ termsAcceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Ensure the user has a profile row, creating a minimal editable one if not.
  // Self-heals legacy accounts that were created without completing the profile.
  async ensureProfile(userId: string): Promise<Profile> {
    const existing = await this.getProfile(userId);
    if (existing) return existing;
    return this.createProfile({
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
    } as any);
  }

  async updateUserSubscription(userId: string, subscriptionData: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionEndDate?: Date;
  }): Promise<User | undefined> {
    const [user] = await this.db.update(users)
      .set({ ...subscriptionData, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserLanguage(userId: string, language: string): Promise<User | undefined> {
    const [user] = await this.db.update(users)
      .set({ language, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async register(registrationData: Registration & { isEmailVerified?: boolean; passwordHash?: string }): Promise<{ user: User; profile: Profile }> {
    // Use the pre-hashed password when the email-verification flow staged one;
    // otherwise hash the plaintext password now.
    const passwordHash = registrationData.passwordHash ?? await this.hashPassword(registrationData.password);

    // Create user
    const [user] = await this.db.insert(users).values({
      email: registrationData.email,
      passwordHash,
      isEmailVerified: registrationData.isEmailVerified ?? false,
    }).returning();

    // Create profile
    const [profile] = await this.db.insert(profiles).values({
      userId: user.id,
      accountType: registrationData.accountType ?? "mom",
      businessName: registrationData.businessName?.trim() || null,
      professionalCategory: registrationData.professionalCategory?.trim() || null,
      firstName: registrationData.firstName,
      lastName: registrationData.lastName,
      age: registrationData.age,
      sex: registrationData.sex,
      bio: registrationData.bio,
      location: registrationData.location,
      photoUrls: registrationData.photoUrls,
      kidsNumber: registrationData.kidsNumber,
      kidsAges: registrationData.kidsAges,
      kidsGenders: registrationData.kidsGenders ?? [],
      hobbies: registrationData.hobbies,
      distanceAway: "0 km",
    }).returning();

    return { user, profile };
  }

  async login(loginData: Login): Promise<User | null> {
    const user = await this.getUserByEmail(loginData.email);
    if (!user) {
      return null;
    }

    if (!user.passwordHash) {
      return null;
    }

    const isPasswordValid = await this.verifyPassword(loginData.password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  // Profile operations
  async getProfiles(): Promise<Profile[]> {
    return this.db.select().from(profiles);
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    const [profile] = await this.db.select().from(profiles).where(eq(profiles.userId, id));
    return profile;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [newProfile] = await this.db.insert(profiles).values(profile).returning();
    return newProfile;
  }

  async updateProfile(id: string, profileData: Partial<InsertProfile>): Promise<Profile | undefined> {
    const [profile] = await this.db.update(profiles)
      .set(profileData)
      .where(eq(profiles.userId, id))
      .returning();
    return profile;
  }

  async deleteProfile(id: string): Promise<void> {
    await this.db.delete(profiles).where(eq(profiles.userId, id));
  }

  async getDiscoverableProfiles(userId: string): Promise<Profile[]> {
    const swipedUserIds = await this.db.select({ targetUserId: swipes.targetUserId })
      .from(swipes)
      .where(eq(swipes.userId, userId));

    const swipedIds = swipedUserIds.map(s => s.targetUserId);

    const discoveryProfiles = await this.db.select()
      .from(profiles)
      .where(and(
        ne(profiles.userId, userId),
        ne(profiles.accountType, "professional"), // professionals never appear in the swipe deck
        swipedIds.length > 0 ? notInArray(profiles.userId, swipedIds) : undefined
      ))
      .limit(10);

    return discoveryProfiles;
  }

  // Mom profiles only (for the map); professionals live in "Intorno a te".
  async getAllMomProfiles(): Promise<Profile[]> {
    return this.db.select().from(profiles)
      .where(ne(profiles.accountType, "professional"));
  }

  async getProfessionalProfiles(): Promise<Profile[]> {
    return this.db.select().from(profiles)
      .where(eq(profiles.accountType, "professional"));
  }

  // Swipe operations
  async createSwipe(swipe: InsertSwipe): Promise<Swipe> {
    const [newSwipe] = await this.db.insert(swipes).values(swipe).returning();
    return newSwipe;
  }

  async getSwipe(userId: string, targetUserId: string): Promise<Swipe | undefined> {
    const [swipe] = await this.db.select().from(swipes)
      .where(and(eq(swipes.userId, userId), eq(swipes.targetUserId, targetUserId)));
    return swipe;
  }

  async getSwipesByUser(userId: string): Promise<Swipe[]> {
    return this.db.select().from(swipes).where(eq(swipes.userId, userId));
  }

  // Match operations
  async createMatch(match: InsertMatch): Promise<Match> {
    const [newMatch] = await this.db.insert(matches).values(match).returning();
    return newMatch;
  }

  async getMatchesByUser(userId: string): Promise<Match[]> {
    return this.db.select().from(matches)
      .where(or(eq(matches.userId, userId), eq(matches.matchedUserId, userId)));
  }

  async getMatch(userId: string, matchedUserId: string): Promise<Match | undefined> {
    const [match] = await this.db.select().from(matches)
      .where(or(
        and(eq(matches.userId, userId), eq(matches.matchedUserId, matchedUserId)),
        and(eq(matches.userId, matchedUserId), eq(matches.matchedUserId, userId))
      ));
    return match;
  }

  async getMatchById(matchId: string): Promise<Match | undefined> {
    const [match] = await this.db.select().from(matches)
      .where(eq(matches.id, matchId));
    return match;
  }

  // ===== Connection request flow =====
  // A match row with isMatch=false is a pending request from userId to
  // matchedUserId; accepting flips isMatch to true and enables messaging.
  async acceptMatch(matchId: string): Promise<Match | undefined> {
    const [match] = await this.db.update(matches)
      .set({ isMatch: true })
      .where(eq(matches.id, matchId))
      .returning();
    return match;
  }

  async deleteMatch(matchId: string): Promise<void> {
    await this.db.delete(matches).where(eq(matches.id, matchId));
  }

  // Incoming pending requests (someone asked to connect with userId)
  async getIncomingRequests(userId: string): Promise<Match[]> {
    return this.db.select().from(matches)
      .where(and(eq(matches.matchedUserId, userId), eq(matches.isMatch, false)));
  }

  // Outgoing pending requests (userId asked, not yet accepted)
  async getOutgoingRequests(userId: string): Promise<Match[]> {
    return this.db.select().from(matches)
      .where(and(eq(matches.userId, userId), eq(matches.isMatch, false)));
  }

  // ===== Events =====
  async createEvent(event: InsertEvent & { status?: string }): Promise<Event> {
    const [newEvent] = await this.db.insert(events).values(event).returning();
    return newEvent;
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await this.db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getAllEvents(): Promise<Event[]> {
    return this.db.select().from(events).orderBy(sql`${events.eventDate} ASC`);
  }

  async updateEventStatus(id: string, status: string): Promise<Event | undefined> {
    const [event] = await this.db.update(events)
      .set({ status })
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async deleteEvent(id: string): Promise<void> {
    await this.db.delete(events).where(eq(events.id, id));
  }

  async updateUserActivity(userId: string): Promise<void> {
    await this.db.update(profiles)
      .set({ lastActiveAt: new Date(), isOnline: true })
      .where(eq(profiles.userId, userId));
  }

  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await this.db.update(profiles)
      .set({ isOnline })
      .where(eq(profiles.userId, userId));
  }

  // Message operations
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await this.db.insert(messages).values(message).returning();
    return newMessage;
  }

  async getMessagesByMatch(matchId: string): Promise<Message[]> {
    return this.db.select().from(messages).where(eq(messages.matchId, matchId));
  }

  // Location operations
  async getAllLocations(): Promise<Location[]> {
    return withDbRetry(() => this.db.select().from(locations));
  }

  // Location categories exist in two shapes ("Parco" from the app, "parco" /
  // "centro-commerciale" from admin CSV imports): compare them normalized.
  private locationCategoryMatches(stored: string, wanted: string): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/-/g, " ").trim();
    return norm(stored) === norm(wanted);
  }

  async getLocationsByCategory(category: string): Promise<Location[]> {
    const all = await withDbRetry(() => this.db.select().from(locations));
    return all.filter((l) => this.locationCategoryMatches(l.category, category));
  }

  async getLocationsByProvince(province: string): Promise<Location[]> {
    return withDbRetry(() => this.db.select().from(locations).where(eq(locations.province, province)));
  }

  async getLocationsByCategoryAndProvince(category: string, province: string): Promise<Location[]> {
    const byProvince = await this.db.select().from(locations).where(eq(locations.province, province));
    return byProvince.filter((l) => this.locationCategoryMatches(l.category, category));
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await this.db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await this.db.insert(locations).values(location).returning();
    return newLocation;
  }

  async updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined> {
    const [updatedLocation] = await this.db.update(locations)
      .set(location)
      .where(eq(locations.id, id))
      .returning();
    return updatedLocation;
  }

  async deleteLocation(id: string): Promise<void> {
    await this.db.delete(locations).where(eq(locations.id, id));
  }

  // Review operations
  async getReviewsByLocation(locationId: string): Promise<Review[]> {
    return withDbRetry(() => this.db.select().from(reviews).where(eq(reviews.locationId, locationId)));
  }

  async getReviewsByUser(userId: string): Promise<Review[]> {
    return this.db.select().from(reviews).where(eq(reviews.userId, userId));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await this.db.insert(reviews).values(review).returning();
    return newReview;
  }

  // Marketplace operations - simplified implementations
  async getAllMarketplaceItems(): Promise<MarketplaceItem[]> {
    return this.db.select().from(marketplaceItems);
  }

  async getMarketplaceItemsByCategory(category: string): Promise<MarketplaceItem[]> {
    // Categories are stored hierarchically ("Passeggini e Viaggi > Passeggini");
    // filtering by a top-level label must match the whole subtree.
    const escaped = category.replace(/[\\%_]/g, (c) => `\\${c}`);
    return this.db.select().from(marketplaceItems)
      .where(ilike(marketplaceItems.category, `${escaped}%`));
  }

  async getMarketplaceItem(id: string): Promise<MarketplaceItem | undefined> {
    const [item] = await this.db.select().from(marketplaceItems).where(eq(marketplaceItems.id, id));
    return item;
  }

  async createMarketplaceItem(item: InsertMarketplaceItem): Promise<MarketplaceItem> {
    const [newItem] = await this.db.insert(marketplaceItems).values(item).returning();
    return newItem;
  }

  async updateMarketplaceItem(id: string, item: Partial<InsertMarketplaceItem>): Promise<MarketplaceItem | undefined> {
    const [updatedItem] = await this.db.update(marketplaceItems)
      .set(item)
      .where(eq(marketplaceItems.id, id))
      .returning();
    return updatedItem;
  }

  async deleteMarketplaceItem(id: string): Promise<void> {
    await this.db.delete(marketplaceItems).where(eq(marketplaceItems.id, id));
  }

  async getMarketplaceItemsBySeller(sellerId: string): Promise<MarketplaceItem[]> {
    return this.db.select().from(marketplaceItems).where(eq(marketplaceItems.sellerId, sellerId));
  }

  // Marketplace message operations
  async getMarketplaceMessagesByItem(itemId: string): Promise<MarketplaceMessage[]> {
    return this.db.select().from(marketplaceMessages).where(eq(marketplaceMessages.itemId, itemId));
  }

  async getMarketplaceMessagesByUser(userId: string): Promise<MarketplaceMessage[]> {
    return this.db.select().from(marketplaceMessages)
      .where(or(eq(marketplaceMessages.buyerId, userId), eq(marketplaceMessages.sellerId, userId)))
      .orderBy(sql`${marketplaceMessages.createdAt} ASC`);
  }

  async createMarketplaceMessage(message: InsertMarketplaceMessage): Promise<MarketplaceMessage> {
    const [newMessage] = await this.db.insert(marketplaceMessages).values(message).returning();
    return newMessage;
  }

  // Saved items operations
  async saveItem(userId: string, itemId: string): Promise<SavedItem> {
    const [savedItem] = await this.db.insert(savedItems).values({
      userId,
      itemId,
    }).returning();
    return savedItem;
  }

  async unsaveItem(userId: string, itemId: string): Promise<void> {
    await this.db.delete(savedItems)
      .where(and(eq(savedItems.userId, userId), eq(savedItems.itemId, itemId)));
  }

  async getSavedItems(userId: string): Promise<MarketplaceItem[]> {
    return this.db
      .select({
        id: marketplaceItems.id,
        sellerId: marketplaceItems.sellerId,
        title: marketplaceItems.title,
        description: marketplaceItems.description,
        price: marketplaceItems.price,
        category: marketplaceItems.category,
        brand: marketplaceItems.brand,
        size: marketplaceItems.size,
        condition: marketplaceItems.condition,
        imageUrls: marketplaceItems.imageUrls,
        location: marketplaceItems.location,
        vintedUrl: marketplaceItems.vintedUrl,
        negotiable: marketplaceItems.negotiable,
        color: marketplaceItems.color,
        material: marketplaceItems.material,
        season: marketplaceItems.season,
        measurements: marketplaceItems.measurements,
        ageRange: marketplaceItems.ageRange,
        isAvailable: marketplaceItems.isAvailable,
        createdAt: marketplaceItems.createdAt,
      })
      .from(savedItems)
      .innerJoin(marketplaceItems, eq(savedItems.itemId, marketplaceItems.id))
      .where(eq(savedItems.userId, userId));
  }

  async isSavedItem(userId: string, itemId: string): Promise<boolean> {
    const [result] = await this.db.select()
      .from(savedItems)
      .where(and(eq(savedItems.userId, userId), eq(savedItems.itemId, itemId)));
    return !!result;
  }


  // Looking for posts operations - simplified implementations
  async getAllLookingForPosts(): Promise<LookingForPost[]> {
    return this.db.select().from(lookingForPosts);
  }

  async getLookingForPostsByCategory(category: string): Promise<LookingForPost[]> {
    return this.db.select().from(lookingForPosts).where(eq(lookingForPosts.category, category));
  }

  async getLookingForPost(id: string): Promise<LookingForPost | undefined> {
    const [post] = await this.db.select().from(lookingForPosts).where(eq(lookingForPosts.id, id));
    return post;
  }

  async createLookingForPost(post: InsertLookingForPost): Promise<LookingForPost> {
    const [newPost] = await this.db.insert(lookingForPosts).values(post).returning();
    return newPost;
  }

  async updateLookingForPost(id: string, post: Partial<InsertLookingForPost>): Promise<LookingForPost | undefined> {
    const [updatedPost] = await this.db.update(lookingForPosts)
      .set(post)
      .where(eq(lookingForPosts.id, id))
      .returning();
    return updatedPost;
  }

  async deleteLookingForPost(id: string): Promise<void> {
    await this.db.delete(lookingForPosts).where(eq(lookingForPosts.id, id));
  }

  // Services operations - simplified implementations
  async getAllServices(): Promise<Service[]> {
    return this.db.select().from(services);
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await this.db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await this.db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined> {
    const [updatedService] = await this.db.update(services)
      .set(service)
      .where(eq(services.id, id))
      .returning();
    return updatedService;
  }

  async deleteService(id: string): Promise<void> {
    await this.db.delete(services).where(eq(services.id, id));
  }

  async getServicesByProvider(providerId: string): Promise<Service[]> {
    return this.db.select().from(services).where(eq(services.providerId, providerId));
  }

  // Service Looking For Post operations - simplified implementations
  async getAllServiceLookingForPosts(): Promise<ServiceLookingForPost[]> {
    return this.db.select().from(serviceLookingForPosts);
  }

  async getServiceLookingForPostsByType(serviceType: string): Promise<ServiceLookingForPost[]> {
    return this.db.select().from(serviceLookingForPosts).where(eq(serviceLookingForPosts.serviceType, serviceType));
  }

  async getServiceLookingForPost(id: string): Promise<ServiceLookingForPost | undefined> {
    const [post] = await this.db.select().from(serviceLookingForPosts).where(eq(serviceLookingForPosts.id, id));
    return post;
  }

  async createServiceLookingForPost(post: InsertServiceLookingForPost): Promise<ServiceLookingForPost> {
    const [newPost] = await this.db.insert(serviceLookingForPosts).values(post).returning();
    return newPost;
  }

  async updateServiceLookingForPost(id: string, post: Partial<InsertServiceLookingForPost>): Promise<ServiceLookingForPost | undefined> {
    const [updatedPost] = await this.db.update(serviceLookingForPosts)
      .set(post)
      .where(eq(serviceLookingForPosts.id, id))
      .returning();
    return updatedPost;
  }

  async deleteServiceLookingForPost(id: string): Promise<void> {
    await this.db.delete(serviceLookingForPosts).where(eq(serviceLookingForPosts.id, id));
  }

  // Interface alias methods to match IStorage exactly
  async getAllProfiles(): Promise<Profile[]> {
    return this.getProfiles();
  }

  // ===== Admin / app settings operations =====
  async getSetting(key: string): Promise<string | undefined> {
    const [row] = await this.db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.insert(appSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  async getAllUsers(): Promise<User[]> {
    return this.db.select().from(users);
  }

  async setProfileTestFlag(profileId: string, isTest: boolean): Promise<Profile | undefined> {
    const [profile] = await this.db.update(profiles)
      .set({ isTestProfile: isTest })
      .where(eq(profiles.id, profileId))
      .returning();
    return profile;
  }

  async markAllProfilesAsTest(): Promise<number> {
    return this.setAllProfilesTest(true);
  }

  // Bulk set/unset the test flag on every profile (used by the admin dashboard).
  async setAllProfilesTest(isTest: boolean): Promise<number> {
    const updated = await this.db.update(profiles)
      .set({ isTestProfile: isTest })
      .returning({ id: profiles.id });
    return updated.length;
  }

  async deleteUserCompletely(userId: string): Promise<void> {
    // Remove all data owned by / referencing the user, then the user itself.
    // No FK constraints in this schema, so order is not critical.
    await this.db.delete(notifications).where(or(eq(notifications.recipientId, userId), eq(notifications.senderId, userId)));
    await this.db.delete(savedItems).where(eq(savedItems.userId, userId));
    await this.db.delete(reviews).where(eq(reviews.userId, userId));
    await this.db.delete(marketplaceMessages).where(or(
      eq(marketplaceMessages.buyerId, userId),
      eq(marketplaceMessages.sellerId, userId),
      eq(marketplaceMessages.senderId, userId),
    ));
    await this.db.delete(marketplaceItems).where(eq(marketplaceItems.sellerId, userId));
    await this.db.delete(services).where(eq(services.providerId, userId));
    await this.db.delete(serviceLookingForPosts).where(eq(serviceLookingForPosts.userId, userId));
    await this.db.delete(lookingForPosts).where(eq(lookingForPosts.userId, userId));
    await this.db.delete(messages).where(eq(messages.senderId, userId));
    await this.db.delete(matches).where(or(eq(matches.userId, userId), eq(matches.matchedUserId, userId)));
    await this.db.delete(swipes).where(or(eq(swipes.userId, userId), eq(swipes.targetUserId, userId)));
    await this.db.delete(blocks).where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
    await this.db.delete(events).where(eq(events.createdByUserId, userId));
    await this.db.delete(reports).where(eq(reports.reporterId, userId));
    await this.db.delete(profiles).where(eq(profiles.userId, userId));
    await this.db.delete(users).where(eq(users.id, userId));
  }

  async getServicesByType(serviceType: string): Promise<Service[]> {
    return this.db.select().from(services).where(eq(services.serviceType, serviceType));
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await this.db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return this.db.select()
      .from(notifications)
      .where(eq(notifications.recipientId, userId))
      .orderBy(sql`${notifications.createdAt} DESC`);
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [updatedNotification] = await this.db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await this.db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));
    return result.count;
  }

  // ===== Block operations (App Store 1.2) =====
  async blockUser(blockerId: string, blockedId: string): Promise<Block> {
    // Idempotent: if the block already exists, return it.
    const [existing] = await this.db.select().from(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
    if (existing) return existing;
    const [block] = await this.db.insert(blocks)
      .values({ blockerId, blockedId })
      .returning();
    return block;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.db.delete(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
  }

  async getBlocksByUser(blockerId: string): Promise<Block[]> {
    return this.db.select().from(blocks).where(eq(blocks.blockerId, blockerId));
  }

  // Every user id blocked by OR blocking the given user: content is hidden in
  // both directions so neither side keeps seeing the other after a block.
  async getBlockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.db.select().from(blocks)
      .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
    const ids = new Set<string>();
    for (const row of rows) {
      ids.add(row.blockerId === userId ? row.blockedId : row.blockerId);
    }
    return Array.from(ids);
  }

  async isBlockedBetween(userIdA: string, userIdB: string): Promise<boolean> {
    const [row] = await this.db.select().from(blocks)
      .where(or(
        and(eq(blocks.blockerId, userIdA), eq(blocks.blockedId, userIdB)),
        and(eq(blocks.blockerId, userIdB), eq(blocks.blockedId, userIdA)),
      ));
    return !!row;
  }

  // ===== Report operations (App Store 1.2) =====
  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await this.db.insert(reports).values(report).returning();
    return newReport;
  }

  async getAllReports(): Promise<Report[]> {
    return this.db.select().from(reports).orderBy(sql`${reports.createdAt} DESC`);
  }

  async updateReportStatus(id: string, status: string): Promise<Report | undefined> {
    const [report] = await this.db.update(reports)
      .set({ status })
      .where(eq(reports.id, id))
      .returning();
    return report;
  }

}

export const storage = new DatabaseStorage();
