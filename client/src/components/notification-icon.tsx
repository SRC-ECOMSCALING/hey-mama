import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface NotificationIconProps {
  className?: string;
}

export default function NotificationIcon({ className = "" }: NotificationIconProps) {
  const [, setLocation] = useLocation();

  // Fetch unread notification count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const unreadCount = unreadData?.count || 0;

  const handleNotificationClick = () => {
    setLocation("/notifications");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`relative rounded-full ${className}`}
      onClick={handleNotificationClick}
      data-testid="button-notifications"
    >
      <Bell className="h-5 w-5 text-gray-600" />
      {unreadCount > 0 && (
        <div 
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs font-medium flex items-center justify-center text-white"
          style={{ backgroundColor: "var(--primary-pink)" }}
          data-testid="badge-notification-count"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </div>
      )}
    </Button>
  );
}