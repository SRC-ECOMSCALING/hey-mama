import { type User, type InsertUser, type Profile, type InsertProfile, type Match, type InsertMatch, type Message, type InsertMessage, type Swipe, type InsertSwipe, type Location, type InsertLocation, type Review, type InsertReview, type MarketplaceItem, type InsertMarketplaceItem, type MarketplaceMessage, type InsertMarketplaceMessage, type LookingForPost, type InsertLookingForPost, type Service, type InsertService, type ServiceLookingForPost, type InsertServiceLookingForPost, type SavedItem, type InsertSavedItem, type Notification, type InsertNotification, type Registration, type Login } from "@shared/schema";
import { randomUUID } from "crypto";
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
  
  // Subscription operations
  updateSubscriptionPlan(userId: string, plan: 'free' | 'pro'): Promise<Profile | undefined>;
  canUserSwipe(userId: string): Promise<{ canSwipe: boolean; remainingSwipes: number }>;
  resetDailySwipes(userId: string): Promise<void>;
  incrementDailySwipes(userId: string): Promise<void>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private profiles: Map<string, Profile>;
  private swipes: Map<string, Swipe>;
  private matches: Map<string, Match>;
  private messages: Map<string, Message>;
  private locations: Map<string, Location>;
  private reviews: Map<string, Review>;
  private marketplaceItems: Map<string, MarketplaceItem>;
  private marketplaceMessages: Map<string, MarketplaceMessage>;
  private lookingForPosts: Map<string, LookingForPost>;
  private services: Map<string, Service>;
  private serviceLookingForPosts: Map<string, ServiceLookingForPost>;
  private savedItems: Map<string, SavedItem>;
  private notifications: Map<string, Notification>;

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
    this.swipes = new Map();
    this.matches = new Map();
    this.messages = new Map();
    this.locations = new Map();
    this.reviews = new Map();
    this.marketplaceItems = new Map();
    this.marketplaceMessages = new Map();
    this.lookingForPosts = new Map();
    this.services = new Map();
    this.serviceLookingForPosts = new Map();
    this.savedItems = new Map();
    this.notifications = new Map();
    
    // Initialize with sample data
    this.initializeSampleData();
    this.initializeMarketplaceSampleData();
    this.initializeLookingForSampleData();
    this.initializeServicesSampleData();
    this.initializeServiceLookingForSampleData();
    
    // Start simulating realistic online/offline patterns
    this.simulateRealisticOnlineStatus();
  }

  private initializeSampleData() {
    const sampleProfiles: Profile[] = [
      {
        id: "user-1",
        userId: "user-1",
        firstName: "Sarah",
        lastName: "Johnson",
        age: 32,
        sex: "female",
        bio: "Stay-at-home mom who loves organizing playdates in the park. Always looking for new friends to share parenting tips and enjoy coffee while our kids play together!",
        location: "Downtown Park Area",
        photoUrls: ["https://images.unsplash.com/photo-1559827260-dc66d52bef19?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 2,
        kidsAges: ["2", "4"],
        kidsGenders: ["female", "male"],
        hobbies: ["Playground dates", "Coffee meetups", "Story time"],
        distanceAway: "Milan",
        dailySwipesUsed: 0,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: true,
        lastActiveAt: new Date(Date.now() - 5 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-2",
        userId: "user-2",
        firstName: "Emma",
        lastName: "Davis",
        age: 29,
        sex: "female",
        bio: "Working mom who loves weekend adventures with my little one. Looking for mom friends for playdates and coffee chats! Always up for spontaneous park visits.",
        location: "Central District",
        photoUrls: ["/attached_assets/Foto chiara_1754408450617.jpg"],
        kidsNumber: 1,
        kidsAges: ["3"],
        kidsGenders: ["female"],
        hobbies: ["Coffee meetups", "Weekend activities", "Nature walks"],
        distanceAway: "Barcelona",
        dailySwipesUsed: 0,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: false,
        lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-3",
        userId: "user-3",
        firstName: "Jessica",
        lastName: "Wilson",
        age: 28,
        sex: "female",
        bio: "First-time mom navigating this beautiful journey! Love connecting with other new moms for support and friendship. Baby-wearing enthusiast looking for gentle parenting friends.",
        location: "Riverside Area",
        photoUrls: ["https://images.unsplash.com/photo-1544717297-fa95b6ee9643?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 1,
        kidsAges: ["1"],
        kidsGenders: ["male"],
        hobbies: ["New mom support", "Baby activities", "Gentle parenting"],
        distanceAway: "Paris",
        dailySwipesUsed: 2,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: true,
        lastActiveAt: new Date(Date.now() - 10 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-4",
        userId: "user-4",
        firstName: "Maria",
        lastName: "Rodriguez",
        age: 35,
        bio: "Bilingual mom raising trilingual kids! Love cultural exchanges and teaching little ones about different languages. Always looking for diverse playdate groups and cultural activities.",
        location: "Cultural Quarter",
        photoUrls: ["https://images.unsplash.com/photo-1607746882042-944635dfe10e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 2,
        kidsAges: ["5", "3"],
        kidsGenders: ["female", "female"],
        hobbies: ["Cultural activities", "Language exchange", "Art projects"],
        sex: "female",
        distanceAway: "Rome",

        dailySwipesUsed: 1,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: true,
        lastActiveAt: new Date(Date.now() - 15 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-5",
        userId: "user-5",
        firstName: "Sophie",
        lastName: "Chen",
        age: 31,
        bio: "Fitness enthusiast mom who believes in staying active with kids! Love stroller fitness classes, family hikes, and teaching children about healthy living. Let's get our kids moving together!",
        location: "Sports Complex Area",
        photoUrls: ["https://images.unsplash.com/photo-1594736797933-d0b22d2ea208?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 2,
        kidsAges: ["4", "6"],
        kidsGenders: ["male", "female"],
        hobbies: ["Fitness activities", "Outdoor sports", "Healthy cooking"],
        sex: "female",
        distanceAway: "Amsterdam",

        dailySwipesUsed: 0,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: false,
        lastActiveAt: new Date(Date.now() - 45 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-6",
        userId: "user-6",
        firstName: "Olivia",
        lastName: "Taylor",
        age: 26,
        sex: "female",
        bio: "Young mom who loves creative activities! Art teacher turned stay-at-home mom. Always planning fun craft projects and sensory play activities. Perfect for creative playdates!",
        location: "Arts District",
        photoUrls: ["https://images.unsplash.com/photo-1619895862022-09114b41f16f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 1,
        kidsAges: ["2"],
        kidsGenders: ["female"],
        hobbies: ["Arts and crafts", "Sensory play", "Music activities"],
        distanceAway: "Berlin",

        dailySwipesUsed: 3,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: true,
        lastActiveAt: new Date(Date.now() - 2 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-7",
        userId: "user-7",
        firstName: "Chloe",
        lastName: "Williams",
        age: 33,
        sex: "female",
        bio: "Working from home mom seeking balance! Tech professional who understands the struggle of juggling work and parenting. Love finding mom friends for support and weekend adventures.",
        location: "Business District",
        photoUrls: ["https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 2,
        kidsAges: ["3", "5"],
        kidsGenders: ["male", "male"],
        hobbies: ["Work-life balance", "Technology", "Weekend getaways"],
        distanceAway: "London",

        dailySwipesUsed: 0,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: true,
        lastActiveAt: new Date(Date.now() - 8 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-8",
        userId: "user-8",
        firstName: "Isabella",
        lastName: "Martinez",
        age: 30,
        sex: "female",
        bio: "Nature-loving mom who believes outdoor time is the best medicine! Love hiking with kids, beach days, and teaching little ones about wildlife. Let's explore nature together!",
        location: "Coastal Area",
        photoUrls: ["https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 1,
        kidsAges: ["4"],
        kidsGenders: ["female"],
        hobbies: ["Nature exploration", "Beach activities", "Wildlife education"],
        distanceAway: "Lisbon",

        dailySwipesUsed: 1,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: false,
        lastActiveAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-9",
        userId: "user-9",
        firstName: "Grace",
        lastName: "Thompson",
        age: 34,
        sex: "female",
        bio: "Bookworm mom raising future readers! Former librarian who loves story time, book clubs, and educational activities. Perfect for quiet playdates and learning adventures!",
        location: "Library District",
        photoUrls: ["https://images.unsplash.com/photo-1551836022-deb4988cc6c0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 2,
        kidsAges: ["3", "5"],
        kidsGenders: ["female", "male"],
        hobbies: ["Reading activities", "Educational games", "Library visits"],
        distanceAway: "Vienna",

        dailySwipesUsed: 2,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: true,
        lastActiveAt: new Date(Date.now() - 20 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-10",
        userId: "user-10",
        firstName: "Zoe",
        lastName: "Anderson",
        age: 27,
        sex: "female",
        bio: "Foodie mom who loves cooking with kids! Culinary school graduate turned mom, always experimenting with healthy kid-friendly recipes. Let's cook and eat together with our little ones!",
        location: "Market District",
        photoUrls: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 2,
        kidsAges: ["2", "4"],
        kidsGenders: ["male", "female"],
        hobbies: ["Cooking activities", "Farmers markets", "Healthy eating"],
        distanceAway: "Brussels",

        dailySwipesUsed: 0,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: false,
        lastActiveAt: new Date(Date.now() - 90 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-11",
        userId: "user-11",
        firstName: "Lily",
        lastName: "Davis",
        age: 29,
        sex: "female",
        bio: "Mindful parenting advocate and yoga instructor! Love teaching kids meditation, yoga poses, and emotional awareness. Looking for like-minded moms for peaceful playdates and wellness activities.",
        location: "Wellness Center",
        photoUrls: ["https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 1,
        kidsAges: ["3"],
        kidsGenders: ["female"],
        hobbies: ["Yoga activities", "Mindfulness", "Emotional wellness"],
        distanceAway: "Copenhagen",

        dailySwipesUsed: 1,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: true,
        lastActiveAt: new Date(Date.now() - 12 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "user-12",
        userId: "user-12",
        firstName: "Ava",
        lastName: "Johnson",
        age: 32,
        sex: "female",
        bio: "Music teacher mom who fills life with songs and laughter! Love introducing kids to different instruments, singing together, and organizing mini concerts. Let's make music with our little ones!",
        location: "Music Academy Area",
        photoUrls: ["https://images.unsplash.com/photo-1494790108755-2616c4f26008?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        kidsNumber: 2,
        kidsAges: ["4", "6"],
        kidsGenders: ["male", "female"],
        hobbies: ["Music activities", "Singing", "Instrument learning"],
        distanceAway: "Prague",

        dailySwipesUsed: 2,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: true,
        lastActiveAt: new Date(Date.now() - 7 * 60 * 1000),
        createdAt: new Date(),
      },
      {
        id: "current-user",
        userId: "current-user",
        firstName: "Amanda",
        lastName: "Smith",
        age: 29,
        sex: "female",
        bio: "First-time mom navigating this beautiful chaos! Love connecting with other moms for support, friendship, and fun activities. Always up for playdates and coffee chats while our little ones play! 💕",
        location: "Main Street",
        photoUrls: ["https://images.unsplash.com/photo-1573496546735-7ce9c1c04c63?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300"],
        kidsNumber: 2,
        kidsAges: ["3", "1"],
        kidsGenders: ["female", "male"],
        hobbies: ["Playground dates", "Coffee meetups", "Story time", "Nature walks"],
        distanceAway: "London",

        dailySwipesUsed: 3,
        lastSwipeResetDate: new Date().toDateString(),
        isOnline: true,
        lastActiveAt: new Date(),
        createdAt: new Date(),
      },
    ];

    sampleProfiles.forEach(profile => {
      this.profiles.set(profile.id, profile);
    });

    // Initialize sample locations
    const sampleLocations: Location[] = [
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
        googlePlaceId: null,
        isGooglePlace: false,
        createdAt: new Date(),
      },
      {
        id: "loc-2",
        name: "Little Sprouts Cafe",
        category: "Cafe",
        address: "456 Main Street, Central District",
        province: "California",
        description: "Family-friendly cafe with kids' play corner, high chairs, and healthy menu options. Great for coffee dates while kids play safely.",
        imageUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        rating: 4,
        amenities: ["Kids play area", "High chairs", "Changing station", "WiFi", "Healthy menu"],
        ageGroups: ["0-2", "3-5"],
        coordinates: "40.7589,-73.9851",
        openingHours: "7:00 AM - 6:00 PM",
        googlePlaceId: null,
        isGooglePlace: false,
        createdAt: new Date(),
      },
      {
        id: "loc-3",
        name: "Adventure Playground",
        category: "Playground",
        address: "789 Pine Avenue, Riverside",
        province: "Texas",
        description: "Large adventure playground with climbing structures, swings, and sand play area. Ideal for active toddlers and young children.",
        imageUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        rating: 5,
        amenities: ["Climbing structures", "Swings", "Sandbox", "Shade areas", "Benches"],
        ageGroups: ["2-5"],
        coordinates: "40.7282,-73.7949",
        openingHours: "8:00 AM - 7:00 PM",
        googlePlaceId: null,
        isGooglePlace: false,
        createdAt: new Date(),
      },
      {
        id: "loc-4",
        name: "City Children's Library",
        category: "Library",
        address: "321 Elm Street, Downtown",
        province: "Illinois",
        description: "Public library with dedicated children's section, story time sessions, and quiet reading areas. Perfect for educational playdates.",
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        rating: 4,
        amenities: ["Story time", "Reading areas", "Educational toys", "Quiet spaces", "Parking"],
        ageGroups: ["0-2", "3-5"],
        coordinates: "40.7505,-73.9934",
        openingHours: "9:00 AM - 8:00 PM",
        googlePlaceId: null,
        isGooglePlace: false,
        createdAt: new Date(),
      },
      {
        id: "loc-5",
        name: "Splash Zone Water Park",
        category: "Water Park",
        address: "654 Water Street, Riverside",
        province: "Florida",
        description: "Family water park with shallow pools, water slides for toddlers, and splash pads. Great for hot summer days with little ones.",
        imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        rating: 5,
        amenities: ["Shallow pools", "Water slides", "Splash pads", "Changing rooms", "Snack bar"],
        ageGroups: ["1-5"],
        coordinates: "40.7411,-73.9897",
        openingHours: "10:00 AM - 6:00 PM (Summer only)",
        googlePlaceId: null,
        isGooglePlace: false,
        createdAt: new Date(),
      },
      {
        id: "loc-6",
        name: "Mom & Me Yoga Studio",
        category: "Activity Center",
        address: "987 Wellness Way, Central District",
        description: "Yoga studio offering parent-child classes, mom fitness sessions, and play groups. Perfect for staying active with your little one.",
        imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68e71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
        rating: 4,
        amenities: ["Yoga classes", "Play groups", "Child care", "Parking", "Showers"],
        ageGroups: ["0-2", "3-5"],
        coordinates: "40.7614,-73.9776",
        openingHours: "6:00 AM - 8:00 PM",
        createdAt: new Date(),
      }
    ];

    sampleLocations.forEach(location => {
      this.locations.set(location.id, location);
    });

    // Initialize sample reviews
    const sampleReviews: Review[] = [
      {
        id: "review-1",
        locationId: "loc-1",
        userId: "user-1",
        rating: 5,
        comment: "Amazing park! My 2-year-old loves the toddler area, and I met some wonderful moms here. The playground is well-maintained and safe.",
        visitedWith: "2-year-old daughter",
        createdAt: new Date(),
      },
      {
        id: "review-2",
        locationId: "loc-2",
        userId: "user-2",
        rating: 4,
        comment: "Great spot for meeting other moms. Coffee is excellent and the kids' area keeps my 3-year-old entertained. Can get busy during lunch hours.",
        visitedWith: "3-year-old son",
        createdAt: new Date(),
      },
      {
        id: "review-3",
        locationId: "loc-1",
        userId: "user-3",
        rating: 5,
        comment: "Perfect for new moms! The walking trail is stroller-friendly and there are always other parents around. My baby loves watching the older kids play.",
        visitedWith: "1-year-old baby",
        createdAt: new Date(),
      }
    ];

    sampleReviews.forEach(review => {
      this.reviews.set(review.id, review);
    });
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  async getAllProfiles(): Promise<Profile[]> {
    return Array.from(this.profiles.values());
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const id = randomUUID();
    const profile: Profile = {
      ...insertProfile,
      id,
      subscriptionPlan: "free",
      dailySwipesUsed: 0,
      lastSwipeResetDate: new Date().toDateString(),
      isOnline: true,
      lastActiveAt: new Date(),
      createdAt: new Date(),
    };
    this.profiles.set(id, profile);
    return profile;
  }

  async updateProfile(id: string, profileUpdate: Partial<InsertProfile>): Promise<Profile | undefined> {
    const existing = this.profiles.get(id);
    if (!existing) return undefined;
    
    const updated: Profile = {
      ...existing,
      ...profileUpdate,
    };
    this.profiles.set(id, updated);
    return updated;
  }

  async createSwipe(insertSwipe: InsertSwipe): Promise<Swipe> {
    const id = randomUUID();
    const swipe: Swipe = {
      ...insertSwipe,
      id,
      createdAt: new Date(),
    };
    this.swipes.set(id, swipe);
    return swipe;
  }

  async getSwipesByUser(userId: string): Promise<Swipe[]> {
    return Array.from(this.swipes.values()).filter(swipe => swipe.userId === userId);
  }

  async getSwipe(userId: string, targetUserId: string): Promise<Swipe | undefined> {
    return Array.from(this.swipes.values()).find(
      swipe => swipe.userId === userId && swipe.targetUserId === targetUserId
    );
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const id = randomUUID();
    const match: Match = {
      id,
      userId: insertMatch.userId,
      matchedUserId: insertMatch.matchedUserId,
      isMatch: insertMatch.isMatch ?? true,
      createdAt: new Date(),
    };
    this.matches.set(id, match);
    return match;
  }

  async getMatchesByUser(userId: string): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(
      match => match.userId === userId || match.matchedUserId === userId
    );
  }

  async getMatch(userId: string, matchedUserId: string): Promise<Match | undefined> {
    return Array.from(this.matches.values()).find(
      match => 
        (match.userId === userId && match.matchedUserId === matchedUserId) ||
        (match.userId === matchedUserId && match.matchedUserId === userId)
    );
  }

  async getMatchById(matchId: string): Promise<Match | undefined> {
    return this.matches.get(matchId);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getMessagesByMatch(matchId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.matchId === matchId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getDiscoverableProfiles(userId: string): Promise<Profile[]> {
    const userSwipes = await this.getSwipesByUser(userId);
    const swipedUserIds = new Set(userSwipes.map(swipe => swipe.targetUserId));
    
    return Array.from(this.profiles.values()).filter(
      profile => profile.id !== userId && !swipedUserIds.has(profile.id)
    );
  }

  // Location operations
  async getAllLocations(): Promise<Location[]> {
    return Array.from(this.locations.values());
  }

  async getLocationsByCategory(category: string): Promise<Location[]> {
    return Array.from(this.locations.values()).filter(
      location => location.category.toLowerCase() === category.toLowerCase()
    );
  }

  async getLocation(id: string): Promise<Location | undefined> {
    return this.locations.get(id);
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const id = randomUUID();
    const location: Location = {
      id,
      name: insertLocation.name,
      category: insertLocation.category,
      address: insertLocation.address,
      description: insertLocation.description,
      imageUrl: insertLocation.imageUrl,
      rating: insertLocation.rating,
      amenities: insertLocation.amenities,
      ageGroups: insertLocation.ageGroups,
      coordinates: insertLocation.coordinates,
      openingHours: insertLocation.openingHours,
      createdAt: new Date(),
    };
    this.locations.set(id, location);
    return location;
  }

  // Review operations
  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = randomUUID();
    const review: Review = {
      id,
      locationId: insertReview.locationId,
      userId: insertReview.userId,
      rating: insertReview.rating,
      comment: insertReview.comment,
      visitedWith: insertReview.visitedWith,
      createdAt: new Date(),
    };
    this.reviews.set(id, review);
    return review;
  }

  async getReviewsByLocation(locationId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(review => review.locationId === locationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getReviewsByUser(userId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(review => review.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Subscription operations
  async updateSubscriptionPlan(userId: string, plan: 'free' | 'pro'): Promise<Profile | undefined> {
    const profile = this.profiles.get(userId);
    if (!profile) return undefined;
    
    const updated: Profile = {
      ...profile,
      subscriptionPlan: plan,
      // Reset daily swipes when upgrading to pro
      dailySwipesUsed: plan === 'pro' ? 0 : profile.dailySwipesUsed,
    };
    this.profiles.set(userId, updated);
    return updated;
  }

  async canUserSwipe(userId: string): Promise<{ canSwipe: boolean; remainingSwipes: number }> {
    const profile = this.profiles.get(userId);
    if (!profile) return { canSwipe: false, remainingSwipes: 0 };

    // Pro users have unlimited swipes
    if (profile.subscriptionPlan === 'pro') {
      return { canSwipe: true, remainingSwipes: -1 }; // -1 indicates unlimited
    }

    // Check if daily reset is needed
    const today = new Date().toDateString();
    if (profile.lastSwipeResetDate !== today) {
      await this.resetDailySwipes(userId);
      return { canSwipe: true, remainingSwipes: 4 }; // 5 - 1 (about to be used)
    }

    // Free users get 5 swipes per day
    const remainingSwipes = Math.max(0, 5 - profile.dailySwipesUsed);
    return { 
      canSwipe: remainingSwipes > 0, 
      remainingSwipes: remainingSwipes 
    };
  }

  async resetDailySwipes(userId: string): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) return;

    const updated: Profile = {
      ...profile,
      dailySwipesUsed: 0,
      lastSwipeResetDate: new Date().toDateString(),
    };
    this.profiles.set(userId, updated);
  }

  async incrementDailySwipes(userId: string): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) return;

    const updated: Profile = {
      ...profile,
      dailySwipesUsed: profile.dailySwipesUsed + 1,
    };
    this.profiles.set(userId, updated);
  }

  // Online status operations
  async updateUserActivity(userId: string): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) return;

    const updated: Profile = {
      ...profile,
      isOnline: true,
      lastActiveAt: new Date(),
    };
    this.profiles.set(userId, updated);
  }

  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) return;

    const updated: Profile = {
      ...profile,
      isOnline,
      lastActiveAt: new Date(),
    };
    this.profiles.set(userId, updated);
  }

  // Helper method to simulate realistic online/offline patterns
  private simulateRealisticOnlineStatus() {
    setInterval(() => {
      this.profiles.forEach((profile, id) => {
        if (id === 'current-user') return; // Don't change current user status
        
        const now = new Date();
        const timeSinceActive = now.getTime() - profile.lastActiveAt.getTime();
        const minutesSinceActive = timeSinceActive / (1000 * 60);
        
        // Simulate users going offline after 30 minutes of inactivity
        // Or randomly coming online
        if (profile.isOnline && minutesSinceActive > 30) {
          this.updateOnlineStatus(id, false);
        } else if (!profile.isOnline && Math.random() < 0.1) { // 10% chance to come online
          this.updateOnlineStatus(id, true);
        }
      });
    }, 60000); // Check every minute
  }

  private initializeMarketplaceSampleData() {
    const sampleMarketplaceItems: MarketplaceItem[] = [
      {
        id: "marketplace-1",
        sellerId: "user-1",
        title: "Baby Stroller - Almost New",
        description: "Barely used stroller in excellent condition. Perfect for newborns to toddlers. Includes rain cover and cup holder. Smoke-free home.",
        price: 12000, // $120.00
        category: "Strollers & Travel",
        condition: "like-new",
        ageRange: "0-3 years",
        imageUrls: ["https://images.unsplash.com/photo-1544717297-fa95b6ee9643?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        location: "Milan",
        vintedUrl: "https://www.vinted.com/items/1234567-baby-stroller-almost-new?utm_source=momsy&utm_medium=commission",
        isAvailable: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        id: "marketplace-2",
        sellerId: "user-2",
        title: "Educational Toys Bundle",
        description: "Collection of Montessori-inspired wooden toys. Great for developing fine motor skills and creativity. Includes blocks, puzzles, and sorting games.",
        price: 3500, // $35.00
        category: "Toys & Games",
        condition: "good",
        ageRange: "2-5 years",
        imageUrls: ["https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        location: "Barcelona",
        vintedUrl: "https://www.vinted.com/items/2345678-educational-toys-bundle?utm_source=momsy&utm_medium=commission",
        isAvailable: true,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      },
      {
        id: "marketplace-3",
        sellerId: "user-4",
        title: "Kids Winter Clothing Lot",
        description: "Size 3-4T winter clothes bundle. Includes 3 coats, 5 sweaters, 4 pairs of pants, and winter accessories. All from smoke-free home.",
        price: 4500, // $45.00
        category: "Clothing",
        condition: "good",
        ageRange: "3-4 years",
        imageUrls: ["https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        location: "Rome",
        vintedUrl: "https://www.vinted.com/items/3456789-kids-winter-clothing-lot?utm_source=momsy&utm_medium=commission",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        id: "marketplace-4",
        sellerId: "user-7",
        title: "High Chair - Adjustable",
        description: "Modern high chair with adjustable height and removable tray. Easy to clean and very sturdy. Perfect condition, only used for 6 months.",
        price: 8000, // $80.00
        category: "Feeding & Highchairs",
        condition: "like-new",
        ageRange: "6 months - 3 years",
        imageUrls: ["https://images.unsplash.com/photo-1586684805175-f8a2d13e1c07?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        location: "London",
        vintedUrl: "https://www.vinted.com/items/4567890-high-chair-adjustable?utm_source=momsy&utm_medium=commission",
        isAvailable: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        id: "marketplace-5",
        sellerId: "user-10",
        title: "Baby Books Collection",
        description: "Set of 15 board books perfect for babies and toddlers. Includes classics like 'Goodnight Moon' and 'The Very Hungry Caterpillar'. Gently used.",
        price: 2000, // $20.00
        category: "Books & Learning",
        condition: "good",
        ageRange: "0-3 years",
        imageUrls: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"],
        location: "Brussels",
        vintedUrl: "https://www.vinted.com/items/5678901-baby-books-collection?utm_source=momsy&utm_medium=commission",
        isAvailable: true,
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      },
    ];

    sampleMarketplaceItems.forEach(item => {
      this.marketplaceItems.set(item.id, item);
    });
  }

  // Marketplace operations
  async getAllMarketplaceItems(): Promise<MarketplaceItem[]> {
    return Array.from(this.marketplaceItems.values())
      .filter(item => item.isAvailable)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getMarketplaceItemsByCategory(category: string): Promise<MarketplaceItem[]> {
    return Array.from(this.marketplaceItems.values())
      .filter(item => item.isAvailable && item.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getMarketplaceItem(id: string): Promise<MarketplaceItem | undefined> {
    return this.marketplaceItems.get(id);
  }

  async createMarketplaceItem(insertItem: InsertMarketplaceItem): Promise<MarketplaceItem> {
    const id = randomUUID();
    const item: MarketplaceItem = {
      ...insertItem,
      id,
      vintedUrl: insertItem.vintedUrl || null,
      isAvailable: true,
      createdAt: new Date(),
    };
    this.marketplaceItems.set(id, item);
    return item;
  }

  async updateMarketplaceItem(id: string, updateData: Partial<InsertMarketplaceItem>): Promise<MarketplaceItem | undefined> {
    const item = this.marketplaceItems.get(id);
    if (!item) return undefined;

    const updated: MarketplaceItem = {
      ...item,
      ...updateData,
    };
    this.marketplaceItems.set(id, updated);
    return updated;
  }

  async deleteMarketplaceItem(id: string): Promise<void> {
    this.marketplaceItems.delete(id);
  }

  async getMarketplaceItemsBySeller(sellerId: string): Promise<MarketplaceItem[]> {
    return Array.from(this.marketplaceItems.values())
      .filter(item => item.sellerId === sellerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Marketplace message operations
  async createMarketplaceMessage(insertMessage: InsertMarketplaceMessage): Promise<MarketplaceMessage> {
    const id = randomUUID();
    const message: MarketplaceMessage = {
      ...insertMessage,
      id,
      createdAt: new Date(),
    };
    this.marketplaceMessages.set(id, message);
    return message;
  }

  async getMarketplaceMessagesByItem(itemId: string): Promise<MarketplaceMessage[]> {
    return Array.from(this.marketplaceMessages.values())
      .filter(message => message.itemId === itemId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // Saved items operations
  async saveItem(userId: string, itemId: string): Promise<SavedItem> {
    const savedItem: SavedItem = {
      id: randomUUID(),
      userId,
      itemId,
      createdAt: new Date(),
    };
    this.savedItems.set(savedItem.id, savedItem);
    return savedItem;
  }

  async unsaveItem(userId: string, itemId: string): Promise<void> {
    const key = Array.from(this.savedItems.entries())
      .find(([_, item]) => item.userId === userId && item.itemId === itemId)?.[0];
    if (key) {
      this.savedItems.delete(key);
    }
  }

  async getSavedItems(userId: string): Promise<MarketplaceItem[]> {
    const userSavedItems = Array.from(this.savedItems.values())
      .filter(savedItem => savedItem.userId === userId);
    
    const savedItemIds = userSavedItems.map(savedItem => savedItem.itemId);
    return Array.from(this.marketplaceItems.values())
      .filter(item => savedItemIds.includes(item.id));
  }

  async isSavedItem(userId: string, itemId: string): Promise<boolean> {
    return Array.from(this.savedItems.values())
      .some(savedItem => savedItem.userId === userId && savedItem.itemId === itemId);
  }

  // Looking For Post operations
  async getAllLookingForPosts(): Promise<LookingForPost[]> {
    return Array.from(this.lookingForPosts.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getLookingForPostsByCategory(category: string): Promise<LookingForPost[]> {
    return Array.from(this.lookingForPosts.values())
      .filter(post => post.category === category)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getLookingForPost(id: string): Promise<LookingForPost | undefined> {
    return this.lookingForPosts.get(id);
  }

  async createLookingForPost(insertPost: InsertLookingForPost): Promise<LookingForPost> {
    const id = randomUUID();
    const post: LookingForPost = {
      ...insertPost,
      id,
      createdAt: new Date(),
    };
    this.lookingForPosts.set(id, post);
    return post;
  }

  async updateLookingForPost(id: string, updateData: Partial<InsertLookingForPost>): Promise<LookingForPost | undefined> {
    const post = this.lookingForPosts.get(id);
    if (!post) return undefined;

    const updated: LookingForPost = {
      ...post,
      ...updateData,
    };
    this.lookingForPosts.set(id, updated);
    return updated;
  }

  async deleteLookingForPost(id: string): Promise<void> {
    this.lookingForPosts.delete(id);
  }

  private initializeLookingForSampleData() {
    const sampleLookingForPosts: LookingForPost[] = [
      {
        id: "looking-1",
        userId: "user-2",
        title: "Looking for Wooden High Chair",
        description: "Searching for a wooden high chair for my 8-month-old. Preferably from a smoke-free home. Open to gently used options.",
        category: "Feeding",
        ageRange: "0-2 years",
        maxPrice: 8000, // €80.00
        location: "Barcelona",
        urgency: "normal",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        id: "looking-2",
        userId: "user-3",
        title: "Need Winter Coat Size 3T",
        description: "Looking for a warm winter coat for my 3-year-old boy. Size 3T. Prefer brands like Zara or H&M Kids. Urgent as winter is coming!",
        category: "Clothing",
        ageRange: "2-4 years",
        maxPrice: 3000, // €30.00
        location: "Madrid",
        urgency: "urgent",
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      },
      {
        id: "looking-3",
        userId: "user-1",
        title: "Educational Books for Toddler",
        description: "Looking for educational books suitable for a 2-year-old. Interactive books with textures or sounds would be perfect. Language: Spanish or English.",
        category: "Books & Media",
        ageRange: "1-3 years",
        maxPrice: 1500, // €15.00
        location: "Milan",
        urgency: "flexible",
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      },
    ];

    sampleLookingForPosts.forEach(post => {
      this.lookingForPosts.set(post.id, post);
    });
  }

  // Services operations
  async getAllServices(): Promise<Service[]> {
    return Array.from(this.services.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getServicesByType(serviceType: string): Promise<Service[]> {
    return Array.from(this.services.values())
      .filter(service => service.serviceType === serviceType)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getService(id: string): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async createService(insertService: InsertService): Promise<Service> {
    const id = randomUUID();
    const service: Service = {
      ...insertService,
      id,
      createdAt: new Date(),
    };
    this.services.set(id, service);
    return service;
  }

  async updateService(id: string, updateData: Partial<InsertService>): Promise<Service | undefined> {
    const service = this.services.get(id);
    if (!service) return undefined;

    const updated: Service = {
      ...service,
      ...updateData,
    };
    this.services.set(id, updated);
    return updated;
  }

  async deleteService(id: string): Promise<void> {
    this.services.delete(id);
  }

  async getServicesByProvider(providerId: string): Promise<Service[]> {
    return Array.from(this.services.values())
      .filter(service => service.providerId === providerId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  private initializeServicesSampleData() {
    const sampleServices: Service[] = [
      {
        id: "service-1",
        providerId: "user-2",
        title: "Experienced Babysitter",
        description: "Certified childcare professional with 5+ years experience. Available for evening babysitting and weekend care. Love engaging with kids through educational games and outdoor activities.",
        serviceType: "Babysitting",
        hourlyRate: 1500, // €15.00 per hour
        location: "Barcelona",
        availability: "Evenings after 6PM, Weekends",
        experience: "5 years",
        certifications: "First Aid Certified, Child Development Course",
        ageGroups: "6 months - 8 years",
        isAvailable: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        id: "service-2",
        providerId: "user-3",
        title: "Math Tutoring for Kids",
        description: "Former teacher offering math tutoring for children ages 4-10. Patient and fun approach to learning. Available for both homework help and skill building sessions.",
        serviceType: "Tutoring",
        hourlyRate: 2000, // €20.00 per hour
        location: "Madrid",
        availability: "Weekday afternoons 3-7PM",
        experience: "8 years",
        certifications: "Teaching Degree, Elementary Math Specialization",
        ageGroups: "4-10 years",
        isAvailable: true,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      },
      {
        id: "service-3",
        providerId: "user-1",
        title: "Home Organization & Cleaning",
        description: "Professional organizer specializing in family homes. Help create kid-friendly storage solutions and maintain tidy spaces. Perfect for busy moms who need extra support.",
        serviceType: "Cleaning",
        hourlyRate: 2500, // €25.00 per hour
        location: "Milan",
        availability: "Flexible weekday schedule",
        experience: "3 years",
        certifications: "Professional Organizer Certification",
        ageGroups: "All families",
        isAvailable: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
    ];

    sampleServices.forEach(service => {
      this.services.set(service.id, service);
    });
  }

  // Service Looking For Post operations
  async getAllServiceLookingForPosts(): Promise<ServiceLookingForPost[]> {
    return Array.from(this.serviceLookingForPosts.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getServiceLookingForPostsByType(serviceType: string): Promise<ServiceLookingForPost[]> {
    return Array.from(this.serviceLookingForPosts.values())
      .filter(post => post.serviceType === serviceType)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getServiceLookingForPost(id: string): Promise<ServiceLookingForPost | undefined> {
    return this.serviceLookingForPosts.get(id);
  }

  async createServiceLookingForPost(insertPost: InsertServiceLookingForPost): Promise<ServiceLookingForPost> {
    const id = randomUUID();
    const post: ServiceLookingForPost = {
      ...insertPost,
      id,
      createdAt: new Date(),
    };
    this.serviceLookingForPosts.set(id, post);
    return post;
  }

  async updateServiceLookingForPost(id: string, updateData: Partial<InsertServiceLookingForPost>): Promise<ServiceLookingForPost | undefined> {
    const post = this.serviceLookingForPosts.get(id);
    if (!post) return undefined;

    const updated: ServiceLookingForPost = {
      ...post,
      ...updateData,
    };
    this.serviceLookingForPosts.set(id, updated);
    return updated;
  }

  async deleteServiceLookingForPost(id: string): Promise<void> {
    this.serviceLookingForPosts.delete(id);
  }

  private initializeServiceLookingForSampleData() {
    const sampleServiceLookingForPosts: ServiceLookingForPost[] = [
      {
        id: "service-looking-1",
        userId: "user-1",
        title: "Need Babysitter for Date Night",
        description: "Looking for a reliable babysitter for Saturday evenings. Need someone with experience with toddlers who can handle bedtime routines. Must be certified in first aid.",
        serviceType: "Babysitting",
        maxHourlyRate: 2000, // €20.00 per hour
        location: "Milan",
        schedule: "Saturday evenings 7PM-12AM",
        ageGroups: "2-4 years",
        urgency: "normal",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        id: "service-looking-2",
        userId: "user-2",
        title: "Math Tutor Needed Urgently",
        description: "My 6-year-old is struggling with basic math concepts. Looking for a patient tutor who specializes in early elementary math. Preferably someone with teaching background.",
        serviceType: "Tutoring",
        maxHourlyRate: 2500, // €25.00 per hour
        location: "Barcelona",
        schedule: "Weekday afternoons 4-6PM",
        ageGroups: "5-7 years",
        urgency: "urgent",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        id: "service-looking-3",
        userId: "user-3",
        title: "House Cleaning Help Needed",
        description: "Overwhelmed mom looking for weekly cleaning help. Need someone who's good with organizing kids' spaces and understands family homes. Flexible on timing.",
        serviceType: "Cleaning",
        maxHourlyRate: 1800, // €18.00 per hour
        location: "Madrid",
        schedule: "Flexible weekdays",
        ageGroups: "All families",
        urgency: "flexible",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      },
    ];

    sampleServiceLookingForPosts.forEach(post => {
      this.serviceLookingForPosts.set(post.id, post);
    });
  }

  // Authentication operations
  async createUser(userData: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...userData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.stripeCustomerId === stripeCustomerId) {
        return user;
      }
    }
    return undefined;
  }

  async updateUserSubscription(userId: string, subscriptionData: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionEndDate?: Date;
  }): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const updatedUser = {
      ...user,
      ...subscriptionData,
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserLanguage(userId: string, language: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const updatedUser = {
      ...user,
      language,
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async register(registrationData: Registration): Promise<{ user: User; profile: Profile }> {
    // Check if user already exists
    const existingUser = await this.getUserByEmail(registrationData.email);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await this.hashPassword(registrationData.password);

    // Create user
    const user = await this.createUser({
      email: registrationData.email,
      passwordHash,
      isEmailVerified: false,
    });

    // Create profile
    const profile = await this.createProfile({
      userId: user.id,
      firstName: registrationData.firstName,
      lastName: registrationData.lastName,
      age: registrationData.age,
      sex: registrationData.sex,
      bio: registrationData.bio,
      location: registrationData.location,
      photoUrls: registrationData.photoUrls,
      kidsNumber: registrationData.kidsNumber,
      kidsAges: registrationData.kidsAges,
      hobbies: registrationData.hobbies,
      distanceAway: "0 km", // Default value
    });

    return { user, profile };
  }

  async login(loginData: Login): Promise<User | null> {
    const user = await this.getUserByEmail(loginData.email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.verifyPassword(loginData.password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  // Location operations by province
  async getLocationsByProvince(province: string): Promise<Location[]> {
    return Array.from(this.locations.values())
      .filter(location => location.province === province)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getLocationsByCategoryAndProvince(category: string, province: string): Promise<Location[]> {
    return Array.from(this.locations.values())
      .filter(location => location.category === category && location.province === province)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const newNotification: Notification = {
      ...notification,
      id,
      createdAt: new Date(),
    };
    this.notifications.set(id, newNotification);
    return newNotification;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.recipientId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;

    const updatedNotification: Notification = {
      ...notification,
      isRead: true,
    };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.recipientId === userId && !notification.isRead)
      .length;
  }
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
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  }

  async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 10);
  }

  async register(registrationData: Registration): Promise<{ user: User; profile: Profile }> {
    // Hash password
    const passwordHash = await this.hashPassword(registrationData.password);

    // Create user
    const [user] = await this.db.insert(users).values({
      email: registrationData.email,
      passwordHash,
      isEmailVerified: false,
    }).returning();

    // Create profile
    const [profile] = await this.db.insert(profiles).values({
      userId: user.id,
      firstName: registrationData.firstName,
      lastName: registrationData.lastName,
      age: registrationData.age,
      sex: registrationData.sex,
      bio: registrationData.bio,
      location: registrationData.location,
      photoUrls: registrationData.photoUrls,
      kidsNumber: registrationData.kidsNumber,
      kidsAges: registrationData.kidsAges,
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

  // For now, implement minimal required methods for other operations
  // You can extend these as needed

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
        swipedIds.length > 0 ? notInArray(profiles.userId, swipedIds) : undefined
      ))
      .limit(10);
    
    return discoveryProfiles;
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

  // Placeholder implementations for other required methods
  async canUserSwipe(userId: string): Promise<{ canSwipe: boolean; remainingSwipes: number }> {
    return { canSwipe: true, remainingSwipes: 999 }; // Unlimited for paid users
  }

  async incrementDailySwipes(userId: string): Promise<void> {
    // No-op for unlimited subscription model
  }

  async resetDailySwipes(userId: string): Promise<void> {
    // No-op for unlimited subscription model
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

  async getLocationsByCategory(category: string): Promise<Location[]> {
    return withDbRetry(() => this.db.select().from(locations).where(eq(locations.category, category)));
  }

  async getLocationsByProvince(province: string): Promise<Location[]> {
    return withDbRetry(() => this.db.select().from(locations).where(eq(locations.province, province)));
  }

  async getLocationsByCategoryAndProvince(category: string, province: string): Promise<Location[]> {
    return this.db.select().from(locations).where(and(eq(locations.category, category), eq(locations.province, province)));
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
    return this.db.select().from(marketplaceItems).where(eq(marketplaceItems.category, category));
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

  async getLookingForPostsByType(type: string): Promise<LookingForPost[]> {
    return this.db.select().from(lookingForPosts).where(eq(lookingForPosts.type, type));
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

  async getServicesByCategory(category: string): Promise<Service[]> {
    return this.db.select().from(services).where(eq(services.category, category));
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
    await this.db.delete(profiles).where(eq(profiles.userId, userId));
    await this.db.delete(users).where(eq(users.id, userId));
  }

  async getServicesByType(serviceType: string): Promise<Service[]> {
    return this.db.select().from(services).where(eq(services.serviceType, serviceType));
  }

  // Additional implementations for interface compliance
  async updateSubscriptionPlan(userId: string, plan: 'free' | 'pro'): Promise<Profile | undefined> {
    const [profile] = await this.db.update(profiles)
      .set({})  // Remove subscriptionPlan as it doesn't exist in schema
      .where(eq(profiles.userId, userId))
      .returning();
    return profile;
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
    const [result] = await this.db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));
    return result.count;
  }

}

export const storage = new DatabaseStorage();
