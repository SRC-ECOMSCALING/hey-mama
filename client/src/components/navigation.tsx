import { Search, Heart, MessageCircle, User, MapPin, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavigationProps {
  includeMarketplace?: boolean;
}

export default function Navigation({ includeMarketplace = false }: NavigationProps) {
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();

  const baseNavItems = [
    { path: "/", icon: Search, label: t("discover") },
    { path: "/locations", icon: MapPin, label: t("locations") },
    { path: "/matches", icon: Heart, label: t("matches") },
    { path: "/messages", icon: MessageCircle, label: t("messages") },
  ];

  const marketplaceItem = { path: "/marketplace", icon: ShoppingBag, label: t("marketplace") };
  const profileItem = { path: "/profile", icon: User, label: t("profile") };

  const navItems = includeMarketplace 
    ? [...baseNavItems, marketplaceItem]
    : [...baseNavItems, profileItem];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 safe-bottom">
      <div className="flex items-center justify-between px-2 py-3">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Button
            key={path}
            variant="ghost"
            className="flex flex-col items-center p-1 h-auto min-w-0 flex-1"
            onClick={() => setLocation(path)}
          >
            <Icon 
              className="h-5 w-5 mb-1" 
              style={{ 
                color: location === path ? "var(--primary-pink)" : "#9CA3AF"
              }} 
            />
            <span 
              className="text-xs font-medium truncate"
              style={{ 
                color: location === path ? "var(--primary-pink)" : "#9CA3AF"
              }}
            >
              {label}
            </span>
          </Button>
        ))}
      </div>
    </nav>
  );
}