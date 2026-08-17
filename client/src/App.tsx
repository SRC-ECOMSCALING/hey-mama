import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Navigation from "@/components/navigation";
import TermsGate from "@/components/terms-gate";
import PageSkeleton, { type SkeletonVariant } from "@/components/page-skeleton";

// Login/registration load eagerly (first paint pre-auth); Discover is the home.
import Login from "@/pages/login";
import Register from "@/pages/register";
import Discover from "@/pages/discover";
import NotFound from "@/pages/not-found";

// Every other page is code-split. The chunk loaders are kept in a map so we
// can prefetch them in the background right after startup: first navigation
// is then instant instead of waiting for the chunk download.
const pageLoaders = {
  locations: () => import("@/pages/locations"),
  messages: () => import("@/pages/messages"),
  chat: () => import("@/pages/chat"),
  marketChat: () => import("@/pages/market-chat"),
  matches: () => import("@/pages/matches"),
  marketplace: () => import("@/pages/marketplace"),
  addProduct: () => import("@/pages/add-product"),
  addService: () => import("@/pages/add-service"),
  profile: () => import("@/pages/profile"),
  profileEdit: () => import("@/pages/profile-edit"),
  settings: () => import("@/pages/settings"),
  events: () => import("@/pages/events"),
  admin: () => import("@/pages/admin"),
  privacy: () => import("@/pages/privacy"),
  terms: () => import("@/pages/terms"),
  support: () => import("@/pages/support"),
};

const Locations = lazy(pageLoaders.locations);
const Messages = lazy(pageLoaders.messages);
const Chat = lazy(pageLoaders.chat);
const MarketChat = lazy(pageLoaders.marketChat);
const Matches = lazy(pageLoaders.matches);
const Marketplace = lazy(pageLoaders.marketplace);
const AddProduct = lazy(pageLoaders.addProduct);
const AddService = lazy(pageLoaders.addService);
const Profile = lazy(pageLoaders.profile);
const ProfileEdit = lazy(pageLoaders.profileEdit);
const Settings = lazy(pageLoaders.settings);
const Events = lazy(pageLoaders.events);
const Admin = lazy(pageLoaders.admin);
const Privacy = lazy(pageLoaders.privacy);
const Terms = lazy(pageLoaders.terms);
const Support = lazy(pageLoaders.support);

// Routes that show the persistent bottom navigation
const NAV_PATHS = new Set([
  "/", "/locations", "/matches", "/messages", "/marketplace", "/events", "/profile",
]);

// Skeleton variant matching the page being loaded, so the placeholder already
// has the right shape while a chunk downloads.
function skeletonFor(path: string): SkeletonVariant {
  if (path === "/") return "map";
  if (path.startsWith("/chat/") || path.startsWith("/market-chat/")) return "chat";
  if (path === "/marketplace") return "grid";
  if (path === "/profile") return "profile";
  if (path.startsWith("/profile/edit") || path.endsWith("/add")) return "form";
  return "list";
}

// Warm-up: preload every page chunk and the data behind the main sections as
// soon as the UI is idle, so moving around the app feels instant.
function usePrefetchApp(isAuthenticated: boolean) {
  useEffect(() => {
    const idle = (cb: () => void) =>
      "requestIdleCallback" in window
        ? (window as any).requestIdleCallback(cb, { timeout: 3000 })
        : setTimeout(cb, 1200);

    idle(() => {
      Object.values(pageLoaders).forEach((load) => {
        load().catch(() => {/* prefetch only — real navigation will retry */});
      });
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(() => {
      const keys: (string | string[])[] = [
        ["/api/profiles", "current-user"],
        "/api/profiles/map",
        "/api/connections/status",
        "/api/connections/requests",
        ["/api/matches", "current-user"],
        ["/api/conversations", "current-user"],
        "/api/marketplace/conversations",
        "/api/locations",
        "/api/professionals",
        "/api/events",
        "/api/marketplace/items",
        "/api/services",
      ];
      keys.forEach((k) => {
        queryClient.prefetchQuery({ queryKey: Array.isArray(k) ? k : [k] }).catch(() => {});
      });
    }, 700);
    return () => clearTimeout(t);
  }, [isAuthenticated]);
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  usePrefetchApp(isAuthenticated);

  // Show loading state while checking authentication
  if (isLoading) {
    return <PageSkeleton variant={skeletonFor(location)} />;
  }

  // If not authenticated, show login/register routes
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageSkeleton variant="form" />}>
        <Switch>
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/support" component={Support} />
          <Route path="/register" component={Register} />
          <Route path="/login" component={Login} />
          <Route path="/" component={Login} />
          <Route component={Login} />
        </Switch>
      </Suspense>
    );
  }

  // If authenticated, show main app routes. The bottom navigation lives HERE,
  // outside the router: it stays mounted while pages change (no reload/flash),
  // and its badge queries keep their state.
  const showNav = NAV_PATHS.has(location);

  return (
    <>
      <TermsGate />
      <Suspense fallback={<PageSkeleton variant={skeletonFor(location)} />}>
        {/* Keyed wrapper: soft fade-up on every page change for smooth navigation */}
        <div key={location} className="animate-fade-up">
        <Switch>
          <Route path="/" component={Discover} />
          <Route path="/admin" component={Admin} />
          <Route path="/locations" component={Locations} />
          <Route path="/messages" component={Messages} />
          <Route path="/chat/:matchId" component={Chat} />
          <Route path="/market-chat/:itemId/:otherUserId" component={MarketChat} />
          <Route path="/matches" component={Matches} />
          <Route path="/marketplace" component={Marketplace} />
          <Route path="/marketplace/add" component={AddProduct} />
          <Route path="/services/add" component={AddService} />
          <Route path="/profile" component={Profile} />
          <Route path="/profile/edit" component={ProfileEdit} />
          <Route path="/settings" component={Settings} />
          <Route path="/events" component={Events} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/support" component={Support} />
          <Route component={NotFound} />
        </Switch>
        </div>
      </Suspense>
      {showNav && <Navigation />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative overflow-hidden">
            <Router />
          </div>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
