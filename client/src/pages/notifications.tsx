import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, UserPlus, Heart, MessageCircle, CalendarDays, Users, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import AppHeader from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { fill } from "@/lib/format";
import type { TranslationKey } from "@/lib/translations";

interface NotificationItem {
  id: string;
  type: string;
  senderId: string;
  recipientId: string;
  message: string;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
  sender: { userId: string; name: string; photoUrl: string | null } | null;
}

// Where a tap on each notification type leads. Older "message" rows stored
// the message id instead of the match id; they fall back to the inbox.
function targetFor(n: NotificationItem): string {
  switch (n.type) {
    case "connection_request":
      return "/matches";
    case "match":
    case "message":
      return n.relatedId ? `/chat/${n.relatedId}` : "/messages";
    case "event":
    case "event_approved":
    case "event_rejected":
    case "event_rsvp":
      return "/events";
    case "new_mom_nearby":
      return "/";
    default:
      return "/";
  }
}

const ICONS: Record<string, typeof Bell> = {
  connection_request: UserPlus,
  match: Heart,
  message: MessageCircle,
  event: CalendarDays,
  event_approved: CalendarDays,
  event_rejected: CalendarDays,
  event_rsvp: Users,
  new_mom_nearby: Sparkles,
};

export default function Notifications() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();

  const { data: items = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications"],
  });

  // Opening the center clears the badge: everything shown is considered seen.
  const markAll = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });
  useEffect(() => {
    if (items.some((n) => !n.isRead)) markAll.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const textFor = (n: NotificationItem): string => {
    const name = n.sender?.name || "HeyMama";
    const keyByType: Record<string, TranslationKey> = {
      connection_request: "notifConnectionRequest",
      match: "notifMatch",
      message: "notifMessage",
      event_approved: "notifEventApproved",
      event_rejected: "notifEventRejected",
      event_rsvp: "notifEventRsvp",
      new_mom_nearby: "notifNewMomNearby",
    };
    const key = keyByType[n.type];
    // Legacy "event" rows keep their stored Italian text
    if (!key) return n.message || t("notifGeneric");
    const province = n.message.split(" a ").pop() ?? "";
    return fill(t(key), { name, province });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <AppHeader right={null} />
      <div className="px-4 pt-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t("notificationsTitle")}</h1>
        {items.some((n) => !n.isRead) && (
          <Button variant="ghost" size="sm" className="text-pink-600" onClick={() => markAll.mutate()} data-testid="button-mark-all-read">
            {t("markAllRead")}
          </Button>
        )}
      </div>

      <div className="p-4 space-y-2">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl skeleton-shimmer" />)
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)" }}>
              <Bell className="h-8 w-8" style={{ color: "var(--primary-pink)" }} />
            </div>
            <h3 className="font-semibold text-gray-900">{t("noNotifications")}</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">{t("noNotificationsHint")}</p>
          </div>
        ) : (
          items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                onClick={() => setLocation(targetFor(n))}
                className={`w-full text-left flex items-center gap-3 rounded-2xl p-3 border transition-colors ${
                  n.isRead ? "bg-white border-gray-100" : "bg-pink-50/60 border-pink-100"
                }`}
                data-testid={`notification-${n.id}`}
              >
                <div className="relative shrink-0">
                  {n.sender?.photoUrl ? (
                    <img src={n.sender.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-pink-100 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-pink-500" />
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center">
                    <Icon className="h-3 w-3 text-pink-500" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.isRead ? "text-gray-700" : "text-gray-900 font-medium"}`}>{textFor(n)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: language === "en" ? undefined : itLocale })}
                  </p>
                </div>
                {!n.isRead && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--primary-pink)" }} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
