import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, CalendarDays, ShoppingBag, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import AppHeader from "@/components/app-header";
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
      // Requests live in the Chat tab
      return "/messages";
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

// Notifications about a thing rather than a person show a violet tile
// instead of the sender's avatar.
function tileIconFor(type: string): typeof Bell | null {
  if (type === "event" || type.startsWith("event_")) return CalendarDays;
  if (type.startsWith("marketplace")) return ShoppingBag;
  return null;
}

type GroupKey = "today" | "week" | "earlier";

function groupFor(createdAt: string, now: Date): GroupKey {
  const d = new Date(createdAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) return "today";
  const weekAgo = new Date(startOfToday);
  weekAgo.setDate(weekAgo.getDate() - 6);
  return d >= weekAgo ? "week" : "earlier";
}

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

  const now = new Date();
  const groups: { key: GroupKey; label: string; rows: NotificationItem[] }[] = [
    { key: "today", label: t("notifGroupToday"), rows: [] },
    { key: "week", label: t("notifGroupThisWeek"), rows: [] },
    { key: "earlier", label: t("notifGroupEarlier"), rows: [] },
  ];
  for (const n of items) {
    groups.find((g) => g.key === groupFor(n.createdAt, now))?.rows.push(n);
  }

  const avatarFor = (n: NotificationItem) => {
    const TileIcon = tileIconFor(n.type);
    if (TileIcon) {
      return (
        <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-purple-50" aria-hidden="true">
          <TileIcon className="h-5 w-5 text-purple-700" strokeWidth={1.9} />
        </span>
      );
    }
    if (n.sender?.photoUrl) {
      return <img src={n.sender.photoUrl} alt="" className="h-[46px] w-[46px] shrink-0 rounded-full object-cover" loading="lazy" />;
    }
    return (
      <span
        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-pink-100 font-display text-base font-semibold text-gray-900"
        aria-hidden="true"
      >
        {n.sender?.name?.trim()?.[0]?.toUpperCase() ?? <Bell className="h-5 w-5 text-pink-500" strokeWidth={1.9} />}
      </span>
    );
  };

  const hasUnread = items.some((n) => !n.isRead);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <AppHeader
        title={t("notificationsTitle")}
        right={
          hasUnread ? (
            <button
              type="button"
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-1 text-[13px] font-semibold text-pink-700"
              onClick={() => markAll.mutate()}
              data-testid="button-mark-all-read"
            >
              {t("markAsReadShort")}
            </button>
          ) : null
        }
      />

      <main className="space-y-[22px] px-5 pt-2">
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => <div key={i} className="h-[74px] rounded-3xl skeleton-shimmer" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
              <Bell className="h-7 w-7 text-pink-500" aria-hidden="true" />
            </div>
            <h2 className="font-display text-xl font-semibold text-gray-900">{t("noNotifications")}</h2>
            <p className="mt-1.5 max-w-xs text-sm text-gray-600">{t("noNotificationsHint")}</p>
          </div>
        ) : (
          groups.filter((g) => g.rows.length > 0).map((g) => (
            <section key={g.key} className="space-y-2.5" aria-label={g.label}>
              <h2 className="section-label">{g.label}</h2>
              <div className="card-float px-4 py-1">
                {g.rows.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setLocation(targetFor(n))}
                    className="flex w-full items-center gap-3 border-b border-gray-100 py-3.5 text-left last:border-0"
                    data-testid={`notification-${n.id}`}
                  >
                    {avatarFor(n)}
                    <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                      <span className={`text-sm leading-[1.35] ${n.isRead ? "text-gray-800" : "font-semibold text-gray-900"}`}>
                        {textFor(n)}
                      </span>
                      <span className="text-xs font-medium leading-none text-gray-600">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: language === "en" ? undefined : itLocale })}
                      </span>
                    </span>
                    {n.type === "connection_request" ? (
                      <span className="inline-flex h-9 shrink-0 items-center rounded-full bg-pink-500 px-3.5 text-[13px] font-semibold text-white">
                        {t("respond")}
                      </span>
                    ) : !n.isRead ? (
                      <span role="img" aria-label={t("notifUnread")} className="h-2.5 w-2.5 shrink-0 rounded-full bg-pink-500" />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))
        )}

        {!isLoading && (
          <p className="flex items-start gap-2.5 text-[13px] leading-[1.45] text-gray-600">
            <ShieldCheck className="mt-px h-[18px] w-[18px] shrink-0 text-purple-600" aria-hidden="true" />
            <span>{t("pushNotificationsDescription")}</span>
          </p>
        )}
      </main>
    </div>
  );
}
