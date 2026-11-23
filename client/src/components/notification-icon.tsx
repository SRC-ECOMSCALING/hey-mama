import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface NotificationIconProps {
  className?: string;
  // "glass" for use over the map, default for the flat page ground
  variant?: "default" | "glass";
}

// Header bell: unread count from the in-app notification center.
export default function NotificationIcon({ className = "", variant = "default" }: NotificationIconProps) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });
  const count = data?.count ?? 0;

  return (
    <button
      type="button"
      aria-label={count > 0 ? `${t("notificationsTitle")} (${count})` : t("notificationsTitle")}
      title={t("notificationsTitle")}
      className={`relative inline-flex shrink-0 items-center justify-center text-gray-900 ${
        variant === "glass" ? "glass h-[54px] w-[54px] rounded-[20px]" : "icon-btn h-12 w-12"
      } ${className}`}
      onClick={() => setLocation("/notifications")}
      data-testid="button-notifications"
    >
      <Bell className="h-[21px] w-[21px]" strokeWidth={1.9} />
      {count > 0 && (
        <span
          className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pink-500 px-1 text-[11px] font-semibold text-white ring-2 ring-white"
          data-testid="badge-unread-notifications"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
