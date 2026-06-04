import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Discover from "@/pages/discover";
import Locations from "@/pages/locations";
import Messages from "@/pages/messages";
import Chat from "@/pages/chat";
import Profile from "@/pages/profile";
import ProfileEdit from "@/pages/profile-edit";
import Matches from "@/pages/matches";
import Marketplace from "@/pages/marketplace";
import AddProduct from "@/pages/add-product";
import AddService from "@/pages/add-service";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Notifications from "@/pages/notifications";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";
import { LanguageProvider } from "@/contexts/LanguageContext";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login/register routes
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/register" component={Register} />
        <Route path="/login" component={Login} />
        <Route path="/" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  // If authenticated, show main app routes
  return (
    <Switch>
      <Route path="/" component={Discover} />
      <Route path="/admin" component={Admin} />
      <Route path="/locations" component={Locations} />
      <Route path="/messages" component={Messages} />
      <Route path="/chat/:matchId" component={Chat} />
      <Route path="/matches" component={Matches} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/marketplace/add" component={AddProduct} />
      <Route path="/services/add" component={AddService} />
      <Route path="/profile" component={Profile} />
      <Route path="/profile/edit" component={ProfileEdit} />
      <Route path="/settings" component={Settings} />
      <Route path="/notifications" component={Notifications} />
      <Route component={NotFound} />
    </Switch>
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
