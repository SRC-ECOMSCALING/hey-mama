# HeyMama - Dating App for Mothers

## Overview

HeyMama is a modern dating application specifically designed for mothers to connect with other mothers. The app features a Tinder-style swiping interface where users can discover profiles, make matches, and start conversations. Additionally, it includes a comprehensive location discovery system for finding family-friendly places perfect for playdates. Built as a mobile-first progressive web application, it provides an intuitive and engaging experience for mothers looking to form meaningful connections.

The application implements a complete dating app workflow including profile discovery, swipe-based matching, real-time match notifications, messaging capabilities, and location discovery with reviews. It's architected as a full-stack application with a React frontend and Express.js backend, utilizing PostgreSQL for data persistence.

## User Preferences

- Preferred communication style: Simple, everyday language
- App name: "HeyMama" 
- Custom logo: Pink gradient logo from attached asset
- Target audience: Mothers with children aged 0-5
- Marketplace integration: Individual Vinted links per item with compact logo design
- Marketplace design: Dark theme with card-style layout, compact Vinted logos (V in teal circle)
- Commission tracking: Each Vinted link includes utm_source=heymama&utm_medium=commission parameters

## System Architecture

### Frontend Architecture
The client-side is built with React 18 using TypeScript and follows a component-based architecture. The application uses Vite as the build tool and development server, providing fast hot module replacement and optimized builds. The UI is constructed with shadcn/ui components built on top of Radix UI primitives and styled with Tailwind CSS.

**Key Frontend Decisions:**
- **React with TypeScript**: Provides type safety and improved developer experience
- **Vite Build System**: Chosen for its fast development server and optimized production builds
- **Wouter for Routing**: Lightweight client-side routing solution suitable for the mobile-first approach
- **TanStack Query**: Handles server state management, caching, and synchronization
- **shadcn/ui Component Library**: Provides accessible, customizable UI components with consistent design

### Backend Architecture
The server is built with Express.js and TypeScript, implementing a RESTful API architecture. The backend handles profile management, swipe logic, match detection, and message storage. Data access goes through the `IStorage` interface in `server/storage.ts`, implemented by `DatabaseStorage` on Drizzle + PostgreSQL.

**Key Backend Decisions:**
- **Express.js Framework**: Provides robust HTTP server capabilities with middleware support
- **TypeScript**: Ensures type safety across the full stack
- **Interface-based Storage**: `IStorage` abstracts persistence; `DatabaseStorage` is the single implementation
- **RESTful API Design**: Uses standard HTTP methods and status codes for predictable API behavior

### Data Storage Solutions
The application is configured to use PostgreSQL as the primary database with Drizzle ORM for type-safe database operations. The schema includes tables for profiles, matches, messages, swipes, locations, and reviews with proper relationships and constraints.

**Database Design Decisions:**
- **PostgreSQL**: Chosen for its reliability, ACID compliance, and rich feature set
- **Drizzle ORM**: Provides type-safe database queries and schema management
- **UUID Primary Keys**: Ensures unique identifiers across distributed systems
- **Timestamp Tracking**: All entities include creation timestamps for audit trails
- **Schema changes**: apply additive SQL (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE
  IF NOT EXISTS`) against the live database; `drizzle-kit push` is unsafe here
  because it proposes dropping the `session` table. Check for drift with
  `npx tsx scripts/schema-diff.ts`.

### External Dependencies
The application integrates several third-party services and libraries:

**UI and Styling:**
- Radix UI for accessible component primitives
- Tailwind CSS for utility-first styling
- Lucide React for consistent iconography

**Hosting and Build Tools:**
- Railway hosts the Express server (deploys on push to `main`)
- Supabase hosts PostgreSQL (connect through the Session pooler URL)
- Uploaded photos live in the `uploaded_images` table and are served by the
  app itself at `/api/uploads/:id` — there is no external object storage
- ESBuild for fast JavaScript bundling

**State Management and Data Fetching:**
- TanStack Query for server state management
- React Hook Form with Zod for form validation
- Custom hooks for swipe gesture detection

The architecture emphasizes type safety, developer experience, and scalability while maintaining a clean separation of concerns between frontend and backend responsibilities.