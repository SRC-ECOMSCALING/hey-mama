import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import { type Notification } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

const CURRENT_USER_ID = "current-user";

export default function Notifications() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest("PUT", `/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      // Invalidate notifications to refresh the list and unread count
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'match') {
      setLocation("/matches");
    } else if (notification.type === 'message' && notification.relatedId) {
      // Find the match for this message to navigate to chat
      setLocation("/messages");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'match':
        return <Heart className="h-5 w-5 text-pink-500" />;
      case 'message':
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-pink"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full"
            onClick={() => setLocation("/messages")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <div className="flex items-center">
            <img 
              src={heyMamaLogo} 
              alt="HeyMama" 
              className="h-10 w-auto object-contain"
            />
          </div>
          <div className="w-10" /> {/* Spacer for balance */}
        </div>
      </header>

      {/* Notifications List */}
      <div className="p-4 space-y-3 pb-20">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">{t("notifications")}</h1>
        
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔔</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("noNotificationsYet")}</h2>
            <p className="text-gray-600">{t("notificationsDescription")}</p>
            <Button 
              onClick={() => setLocation("/matches")}
              className="mt-4"
              style={{ 
                background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
              }}
              data-testid="button-view-matches"
            >
              <Heart className="w-4 h-4 mr-2" />
              {t("viewMatches")}
            </Button>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200 ${
                notification.isRead 
                  ? 'bg-gray-50 hover:bg-gray-100' 
                  : 'bg-pink-50 hover:bg-pink-100 border-l-4 border-pink-500'
              }`}
              onClick={() => handleNotificationClick(notification)}
              data-testid={`notification-${notification.id}`}
            >
              <div className="flex-shrink-0">
                {getNotificationIcon(notification.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${notification.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                  {notification.message}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(notification.createdAt), { 
                    addSuffix: true,
                    locale: language === "it" ? it : undefined
                  })}
                </p>
              </div>
              
              {!notification.isRead && (
                <div className="w-2 h-2 rounded-full bg-pink-500 flex-shrink-0"></div>
              )}
            </div>
          ))
        )}
      </div>

      <Navigation />
    </>
  );
}