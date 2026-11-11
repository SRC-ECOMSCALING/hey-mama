import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface NotificationIconProps {
  className?: string;
}

// Header bell: unread count from the in-app notification center.
export default function NotificationIcon({ className = "" }: NotificationIconProps) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });
  const count = data?.count ?? 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("notificationsTitle")}
      title={t("notificationsTitle")}
      className={`relative rounded-full ${className}`}
      onClick={() => setLocation("/notifications")}
      data-testid="button-notifications"
    >
      <Bell className="h-5 w-5 text-gray-600" />
      {count > 0 && (
        <span
          className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
          style={{ backgroundColor: "var(--primary-pink)" }}
          data-testid="badge-unread-notifications"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}
