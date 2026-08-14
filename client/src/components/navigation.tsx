import { Search, Users, MessageCircle, User, MapPin, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavigationProps {
  includeMarketplace?: boolean;
}

// Icon-only bottom navigation. Labels are exposed via aria-label only.
export default function Navigation({ includeMarketplace: _includeMarketplace }: NavigationProps = {}) {
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();

  // Badge on "Connessioni": incoming pending connection requests
  const { data: requests } = useQuery<{ incoming: any[]; outgoing: any[] }>({
    queryKey: ["/api/connections/requests"],
    refetchInterval: 30000,
  });
  const incomingCount = requests?.incoming?.length || 0;

  const navItems = [
    { path: "/", icon: Search, label: t("discover") },
    { path: "/locations", icon: MapPin, label: t("aroundYou") },
    { path: "/matches", icon: Users, label: t("connections"), badge: incomingCount },
    { path: "/messages", icon: MessageCircle, label: t("messages") },
    { path: "/marketplace", icon: ShoppingBag, label: t("marketplace") },
    { path: "/profile", icon: User, label: t("profile") },
  ];

  return (
    <nav className="fixed left-4 right-4 mx-auto max-w-[26rem] z-50 bg-white/85 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_8px_30px_rgba(236,72,153,0.12)] bottom-[calc(1rem_+_env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between px-2 py-1.5">
        {navItems.map(({ path, icon: Icon, label, badge }) => {
          const isActive = location === path;
          return (
            <Button
              key={path}
              variant="ghost"
              aria-label={label}
              title={label}
              className={`relative flex items-center justify-center p-0 h-11 w-11 min-w-0 flex-1 rounded-2xl transition-all duration-200 ${
                isActive ? "bg-pink-50 hover:bg-pink-100/80 scale-105" : "hover:bg-gray-50"
              }`}
              onClick={() => setLocation(path)}
            >
              <Icon
                className={`h-[22px] w-[22px] transition-colors ${isActive ? "stroke-[2.4]" : ""}`}
                style={{ color: isActive ? "var(--primary-pink)" : "#9CA3AF" }}
              />
              {!!badge && badge > 0 && (
                <span
                  className="absolute top-1 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
                  style={{ backgroundColor: "var(--primary-pink)" }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {isActive && (
                <span
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: "var(--primary-pink)" }}
                />
              )}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
