import { Compass, CalendarDays, MessageCircle, ShoppingBag, User } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

// Bottom navigation: five labelled destinations in a floating glass bar.
// "Chat" gathers connection requests and conversations, so its badge counts
// both; places and professionals live inside Esplora, settings inside Profilo.
export default function Navigation() {
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();

  const { data: requests } = useQuery<{ incoming: any[]; outgoing: any[] }>({
    queryKey: ["/api/connections/requests"],
    refetchInterval: 30000,
  });
  const incomingCount = requests?.incoming?.length || 0;

  const navItems = [
    { path: "/", icon: Compass, label: t("navExplore") },
    { path: "/events", icon: CalendarDays, label: t("events") },
    { path: "/messages", icon: MessageCircle, label: t("navChat"), badge: incomingCount },
    { path: "/marketplace", icon: ShoppingBag, label: t("marketplace") },
    { path: "/profile", icon: User, label: t("profile") },
  ];

  return (
    <nav
      aria-label={t("navMain")}
      className="glass fixed left-3 right-3 z-50 mx-auto flex h-[68px] max-w-[26.5rem] items-center rounded-[34px] px-1.5 bottom-[calc(0.875rem_+_env(safe-area-inset-bottom))]"
    >
      {navItems.map(({ path, icon: Icon, label, badge }) => {
        const isActive = location === path;
        return (
          <button
            key={path}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => setLocation(path)}
            className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-[5px] text-[11px] leading-none ${
              isActive ? "font-semibold text-pink-700" : "font-semibold text-gray-700"
            }`}
            data-testid={`nav-${path === "/" ? "explore" : path.slice(1)}`}
          >
            <span
              className={`relative flex h-7 w-[46px] items-center justify-center rounded-full transition-colors duration-200 ${
                isActive ? "bg-pink-50" : ""
              }`}
            >
              <Icon className={isActive ? "h-[18px] w-[18px] text-pink-500" : "h-5 w-5 text-gray-700"} strokeWidth={isActive ? 2.2 : 1.9} />
              {!!badge && badge > 0 && (
                <span className="absolute -top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-semibold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span className="max-w-full truncate px-0.5">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
