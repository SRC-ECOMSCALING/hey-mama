import { Search, Users, MessageCircle, User, MapPin, ShoppingBag } from "lucide-react";
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
    { path: "/matches", icon: Users, label: t("connections") },
    { path: "/messages", icon: MessageCircle, label: t("messages") },
  ];

  const marketplaceItem = { path: "/marketplace", icon: ShoppingBag, label: t("marketplace") };
  const profileItem = { path: "/profile", icon: User, label: t("profile") };

  const navItems = includeMarketplace 
    ? [...baseNavItems, marketplaceItem]
    : [...baseNavItems, profileItem];

  return (
    <nav className="fixed left-4 right-4 mx-auto max-w-[26rem] z-50 bg-white/90 backdrop-blur-md border border-gray-100 rounded-2xl shadow-lg bottom-[calc(1rem_+_env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between px-2 py-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location === path;
          return (
            <Button
              key={path}
              variant="ghost"
              className={`flex flex-col items-center p-1.5 h-auto min-w-0 flex-1 rounded-xl transition-colors ${
                isActive ? "bg-pink-50 hover:bg-pink-50" : "hover:bg-gray-50"
              }`}
              onClick={() => setLocation(path)}
            >
              <Icon
                className="h-5 w-5 mb-0.5"
                style={{
                  color: isActive ? "var(--primary-pink)" : "#9CA3AF"
                }}
              />
              <span
                className="text-xs font-medium truncate"
                style={{
                  color: isActive ? "var(--primary-pink)" : "#9CA3AF"
                }}
              >
                {label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}