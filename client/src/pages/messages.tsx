import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, MessageCircle, Plus, ShoppingBag, type LucideIcon } from "lucide-react";
import { useLocation } from "wouter";
import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import type { Match, PublicProfile as Profile, Message, MarketplaceItem, MarketplaceMessage, Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { apiRequest } from "@/lib/queryClient";
import { fill } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/translations";
import PageSkeleton from "@/components/page-skeleton";
import AppHeader from "@/components/app-header";
import ActivityBadge from "@/components/activity-badge";
import PhotoCarousel from "@/components/photo-carousel";
import ReportBlockControls from "@/components/report-block";

const CURRENT_USER_ID = "current-user";

interface Conversation {
  matchId: string;
  match: Match;
  profile: Profile | null;
  otherUserId: string;
  lastMessage: Message;
  messageCount: number;
  unreadCount: number;
}

interface MarketConversation {
  itemId: string;
  otherUserId: string;
  lastMessage: MarketplaceMessage;
  messageCount: number;
  unreadCount: number;
  item: MarketplaceItem | null;
  service?: Service | null;
  otherProfile: Profile | null;
}

interface MatchWithProfile extends Match {
  profile?: Profile;
  matchedUserId: string;
}

interface ConnectionRequest extends Match {
  otherUserId: string;
  profile: Profile;
  message: string | null;
}

type Filter = "all" | "moms" | "market";

type Row =
  | { kind: "mom"; key: string; ts: number; c: Conversation }
  | { kind: "market"; key: string; ts: number; c: MarketConversation };

const isFresh = (p?: Pick<Profile, "isOnline" | "activityBand"> | null) => !!p?.isOnline || p?.activityBand === "today";

// Time of the last message as a messaging app shows it: the hour today,
// "yesterday", the weekday within a week, otherwise the date.
function formatListTime(value: Date | string, language: Language, yesterday: string): string {
  const date = new Date(value);
  const locale = language === "en" ? undefined : itLocale;
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return yesterday;
  if (differenceInCalendarDays(new Date(), date) < 7) {
    const day = format(date, "EEE", { locale });
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  return format(date, "d MMM", { locale });
}

function formatConnectedDate(value: Date | string, language: Language): string {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  if (language === "en") return format(date, sameYear ? "EEEE, MMMM d" : "MMMM d, yyyy");
  return format(date, sameYear ? "EEEE d MMMM" : "'il' d MMMM yyyy", { locale: itLocale });
}

function Avatar({ src, name, online, className = "" }: { src?: string | null; name?: string | null; online?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-pink-100 font-display font-semibold text-gray-900 ${
        online ? "ring-online" : ""
      } ${className}`}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        (name ?? "").charAt(0).toUpperCase()
      )}
    </span>
  );
}

function EmptyState({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="card-float flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
        <Icon className="h-7 w-7 text-pink-500" strokeWidth={1.9} />
      </span>
      <h2 className="mt-4 font-display text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{text}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

// The Chat tab: connection requests, connected moms and every conversation
// (moms and marketplace) in one list.
export default function Messages() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>("all");
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showAllMoms, setShowAllMoms] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithProfile | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations", CURRENT_USER_ID],
    refetchInterval: 5000, // Refresh every 5 seconds for new messages
  });

  const { data: marketConversations = [], isLoading: isLoadingMarket } = useQuery<MarketConversation[]>({
    queryKey: ["/api/marketplace/conversations"],
    refetchInterval: 5000,
  });

  // Accepted connections
  const { data: matches = [] } = useQuery<MatchWithProfile[]>({
    queryKey: ["/api/matches", CURRENT_USER_ID],
  });

  // Pending connection requests (incoming must be accepted before messaging)
  const { data: requests } = useQuery<{ incoming: ConnectionRequest[]; outgoing: ConnectionRequest[] }>({
    queryKey: ["/api/connections/requests"],
  });
  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];

  const invalidateConnections = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/connections/requests"] });
    queryClient.invalidateQueries({ queryKey: ["/api/connections/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/matches", CURRENT_USER_ID] });
  };

  const acceptMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const res = await apiRequest("POST", `/api/connections/${matchId}/accept`);
      // The server answers with the accepted connection; its id is the chat id.
      return (await res.json().catch(() => null)) as { id?: string } | null;
    },
    onSuccess: (accepted) => {
      toast({ title: t("requestAccepted"), description: t("nowSendMessages") });
      invalidateConnections();
      if (accepted?.id) setLocation(`/chat/${accepted.id}`);
    },
    onError: () => {
      toast({ title: t("error"), description: t("somethingWentWrong"), variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (matchId: string) => apiRequest("POST", `/api/connections/${matchId}/decline`),
    onSuccess: () => {
      toast({ title: t("requestDeclined") });
      invalidateConnections();
    },
    onError: () => {
      toast({ title: t("error"), description: t("somethingWentWrong"), variant: "destructive" });
    },
  });

  const startConversationMutation = useMutation({
    mutationFn: async (matchedUserId: string) => {
      const response = await fetch("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ matchedUserId }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.statusText}`);
      }

      return await response.json();
    },
    onSuccess: (conversation) => {
      // Invalidate conversations cache
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      // Navigate directly to the chat interface
      setLocation(`/chat/${conversation.matchId}`);
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("errorStartingConversation"),
        variant: "destructive",
      });
    },
  });

  if (isLoading && isLoadingMarket) {
    return <PageSkeleton variant="list" />;
  }

  const momsUnreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const marketUnreadTotal = marketConversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  // One list, most recent first
  const rows: Row[] = [
    ...(filter !== "market"
      ? conversations.map((c): Row => ({ kind: "mom", key: `mom-${c.matchId}`, ts: new Date(c.lastMessage.createdAt).getTime(), c }))
      : []),
    ...(filter !== "moms"
      ? marketConversations.map((c): Row => ({
          kind: "market",
          key: `market-${c.itemId}-${c.otherUserId}`,
          ts: new Date(c.lastMessage.createdAt).getTime(),
          c,
        }))
      : []),
  ].sort((a, b) => b.ts - a.ts);
  const listLoading = (filter !== "market" && isLoading) || (filter !== "moms" && isLoadingMarket);

  const visibleRequests = showAllRequests ? incoming : incoming.slice(0, 1);
  const requestPending = acceptMutation.isPending || declineMutation.isPending;

  const requestDetails = (p?: Profile | null) =>
    [
      p?.age != null ? `${p.age} ${t("yearsOld")}` : null,
      p?.kidsAges?.length ? fill(t("chatKidsAges"), { ages: p.kidsAges.join(", ") }) : null,
      p?.location || null,
    ]
      .filter(Boolean)
      .join(" · ");

  const openProfile = (match: MatchWithProfile) => {
    setSelectedMatch(match);
    setShowProfileSheet(true);
  };

  const filters: { id: Filter; label: string; unread: number; testId?: string; badgeTestId?: string }[] = [
    { id: "all", label: t("chatFilterAll"), unread: 0 },
    { id: "moms", label: t("chatFilterMoms"), unread: momsUnreadTotal, testId: "tab-match-chats" },
    { id: "market", label: t("marketplace"), unread: marketUnreadTotal, testId: "tab-market-chats", badgeTestId: "badge-market-unread" },
  ];

  const sheetProfile = selectedMatch?.profile ?? null;

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <AppHeader title={t("navChat")} left="none" />

      <main className="space-y-5 px-5">
        {/* Incoming connection requests */}
        {incoming.length > 0 && (
          <section className="space-y-2.5" aria-label={t("requestsReceived")}>
            <div className="flex min-h-7 items-center justify-between">
              <h2 className="section-label font-sans tracking-normal">{fill(t("chatRequestsCount"), { count: incoming.length })}</h2>
              {incoming.length > 1 && (
                <button
                  type="button"
                  className="-my-2 flex min-h-11 items-center text-[13px] font-semibold text-pink-700"
                  aria-expanded={showAllRequests}
                  onClick={() => setShowAllRequests((v) => !v)}
                  data-testid="button-toggle-requests"
                >
                  {showAllRequests ? t("chatShowLess") : t("chatSeeAll")}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {visibleRequests.map((req) => {
                const details = requestDetails(req.profile);
                return (
                  <div key={req.id} className="card-float flex flex-col gap-3 p-4" data-testid={`request-incoming-${req.id}`}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={req.profile?.photoUrls?.[0]}
                        name={req.profile?.firstName}
                        online={isFresh(req.profile)}
                        className="h-12 w-12 text-[17px]"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <h3 className="truncate font-display text-base font-semibold leading-tight text-gray-900">
                          {fill(t("chatWantsToMeet"), { name: req.profile?.firstName ?? "" })}
                        </h3>
                        {details && <p className="truncate text-[13px] leading-tight text-gray-600">{details}</p>}
                        <ActivityBadge isOnline={req.profile?.isOnline} activityBand={req.profile?.activityBand} variant="text" />
                      </div>
                      {/* Report / block whoever sent the request (App Store 1.2) */}
                      {req.profile && (
                        <ReportBlockControls
                          targetUserId={req.profile.userId}
                          targetType="connection_request"
                          targetId={req.id}
                          variant="icons"
                          className="-mr-2 shrink-0 self-start"
                        />
                      )}
                    </div>
                    {req.message && (
                      <p
                        className="rounded-[14px] bg-gray-50 px-3.5 py-2.5 text-sm leading-relaxed text-gray-800"
                        data-testid={`request-message-${req.id}`}
                      >
                        «{req.message}»
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2.5">
                      <Button
                        variant="ghost"
                        className="h-12 bg-gray-50 text-gray-900"
                        onClick={() => declineMutation.mutate(req.id)}
                        disabled={requestPending}
                        data-testid={`button-decline-${req.id}`}
                      >
                        {t("chatNotNow")}
                      </Button>
                      <Button
                        className="h-12"
                        onClick={() => acceptMutation.mutate(req.id)}
                        disabled={requestPending}
                        data-testid={`button-accept-${req.id}`}
                      >
                        {t("chatAcceptReply")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Connected moms */}
        <section className="space-y-2.5" aria-label={t("chatYourMoms")}>
          <div className="flex min-h-7 items-center justify-between">
            <h2 className="section-label font-sans tracking-normal">{t("chatYourMoms")}</h2>
            {matches.length > 0 && (
              <button
                type="button"
                className="-my-2 flex min-h-11 items-center text-[13px] font-semibold text-pink-700"
                aria-expanded={showAllMoms}
                onClick={() => setShowAllMoms((v) => !v)}
                data-testid="button-toggle-moms"
              >
                {showAllMoms ? t("chatShowLess") : t("chatSeeAll")}
              </button>
            )}
          </div>

          <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 py-1.5">
            {matches.map((match) => (
              <button
                key={match.id}
                type="button"
                className="flex w-14 shrink-0 flex-col items-center gap-[7px] text-xs font-medium leading-none text-gray-900"
                aria-label={fill(t("chatWriteTo"), { name: match.profile?.firstName ?? "" })}
                onClick={() => startConversationMutation.mutate(match.matchedUserId)}
                disabled={startConversationMutation.isPending}
                data-testid={`mom-${match.id}`}
              >
                <Avatar
                  src={match.profile?.photoUrls?.[0]}
                  name={match.profile?.firstName}
                  online={isFresh(match.profile)}
                  className="h-[52px] w-[52px] text-lg"
                />
                <span className="max-w-full truncate">{match.profile?.firstName}</span>
              </button>
            ))}
            <button
              type="button"
              className="flex w-14 shrink-0 flex-col items-center gap-[7px] text-xs font-medium leading-none text-gray-600"
              aria-label={t("chatFindMoms")}
              onClick={() => setLocation("/")}
              data-testid="button-find-moms"
            >
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-dashed border-gray-400">
                <Plus className="h-5 w-5" strokeWidth={2} />
              </span>
              <span>{t("chatFind")}</span>
            </button>
          </div>

          {/* Full list: profile and message for every connection */}
          {showAllMoms && matches.length > 0 && (
            <div className="card-float px-4">
              {matches.map((match) => {
                const p = match.profile;
                const details = [p?.location || null, p?.kidsAges?.length ? fill(t("chatKidsAges"), { ages: p.kidsAges.join(", ") }) : null]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={match.id} className="flex items-center gap-2 border-b border-gray-100 py-3 last:border-0" data-testid={`connection-${match.id}`}>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-label={`${t("viewProfile")}: ${p?.firstName ?? ""}`}
                      onClick={() => openProfile(match)}
                    >
                      <Avatar src={p?.photoUrls?.[0]} name={p?.firstName} online={isFresh(p)} className="h-[46px] w-[46px] text-base" />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate font-display text-[15px] font-semibold leading-tight text-gray-900">
                          {p?.firstName} {p?.lastName}
                          {p?.age != null ? `, ${p.age}` : ""}
                        </span>
                        {details && <span className="truncate text-[13px] leading-tight text-gray-600">{details}</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-700"
                      aria-label={fill(t("chatWriteTo"), { name: p?.firstName ?? "" })}
                      onClick={() => startConversationMutation.mutate(match.matchedUserId)}
                      disabled={startConversationMutation.isPending}
                      data-testid="button-message"
                    >
                      <MessageCircle className="h-5 w-5" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Conversations: moms and marketplace together */}
        <section className="space-y-3" aria-label={t("chatConversations")}>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                className={`chip ${filter === f.id ? "chip-on" : ""}`}
                onClick={() => setFilter(f.id)}
                data-testid={f.testId ?? "tab-all-chats"}
              >
                {f.label}
                {f.unread > 0 && (
                  <span
                    className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pink-500 px-1 text-[11px] font-semibold leading-none text-white"
                    data-testid={f.badgeTestId}
                  >
                    {f.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {rows.length > 0 ? (
            <div className="card-float px-4">
              {rows.map((row) => {
                if (row.kind === "mom") {
                  const c = row.c;
                  const unread = c.unreadCount > 0;
                  const mine = c.lastMessage.senderId !== c.otherUserId;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      className="flex w-full items-center gap-3 border-b border-gray-100 py-3.5 text-left last:border-0"
                      onClick={() => setLocation(`/chat/${c.matchId}`)}
                      data-testid={`conversation-${c.matchId}`}
                    >
                      <Avatar
                        src={c.profile?.photoUrls?.[0]}
                        name={c.profile?.firstName}
                        online={isFresh(c.profile)}
                        className="h-[46px] w-[46px] text-base"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                        <span className="truncate font-display text-[15px] font-semibold leading-tight text-gray-900">
                          {c.profile?.firstName} {c.profile?.lastName}
                        </span>
                        <span className={`truncate text-[13px] leading-tight ${unread ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                          {mine ? `${t("chatYou")}: ` : ""}
                          {c.lastMessage.content}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`text-xs font-medium leading-none ${unread ? "text-pink-700" : "text-gray-600"}`}>
                          {formatListTime(c.lastMessage.createdAt, language, t("yesterday"))}
                        </span>
                        {unread && (
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500 px-1.5 text-[11px] font-semibold leading-none text-white"
                            aria-label={fill(t("chatUnread"), { count: c.unreadCount })}
                            data-testid={`unread-dot-${c.matchId}`}
                          >
                            {c.unreadCount}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                }

                const c = row.c;
                const unread = c.unreadCount > 0;
                const mine = c.lastMessage.senderId !== c.otherUserId;
                const subject = c.item?.title ?? c.service?.title ?? t("listingFallback");
                return (
                  <button
                    key={row.key}
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-gray-100 py-3.5 text-left last:border-0"
                    onClick={() => setLocation(`/market-chat/${c.itemId}/${c.otherUserId}`)}
                    data-testid={`market-conversation-${c.itemId}-${c.otherUserId}`}
                  >
                    <span aria-hidden="true" className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-purple-50">
                      <ShoppingBag className="h-5 w-5 text-purple-700" strokeWidth={1.9} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                      <span className="truncate font-display text-[15px] font-semibold leading-tight text-gray-900">
                        {subject} · {c.otherProfile?.firstName ?? t("userFallback")}
                      </span>
                      <span className={`truncate text-[13px] leading-tight ${unread ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                        {mine ? `${t("chatYou")}: ` : ""}
                        {c.lastMessage.content}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`text-xs font-medium leading-none ${unread ? "text-pink-700" : "text-gray-600"}`}>
                        {formatListTime(c.lastMessage.createdAt, language, t("yesterday"))}
                      </span>
                      {unread && (
                        <span
                          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500 px-1.5 text-[11px] font-semibold leading-none text-white"
                          aria-label={fill(t("chatUnread"), { count: c.unreadCount })}
                          data-testid={`unread-dot-market-${c.itemId}`}
                        >
                          {c.unreadCount}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : listLoading ? null : filter === "market" ? (
            <EmptyState icon={ShoppingBag} title={t("noMarketChats")} text={t("startMarketChatHint")}>
              <Button onClick={() => setLocation("/marketplace")} data-testid="button-go-market">
                <ShoppingBag />
                {t("goToMarket")}
              </Button>
            </EmptyState>
          ) : matches.length > 0 ? (
            <EmptyState icon={MessageCircle} title={t("noConversationsYet")} text={t("chatEmptyMomsHint")} />
          ) : (
            <EmptyState icon={MessageCircle} title={t("noConversationsYet")} text={t("noMatchesHint")}>
              <Button onClick={() => setLocation("/")} data-testid="button-find-moms-empty">
                {t("chatFindMoms")}
              </Button>
            </EmptyState>
          )}
        </section>

        {/* Requests the user sent that are still unanswered */}
        {outgoing.length > 0 && (
          <section className="space-y-2.5" aria-label={t("requestsSent")}>
            <h2 className="section-label font-sans tracking-normal">{t("chatAwaitingReply")}</h2>
            <div className="card-float px-4">
              {outgoing.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"
                  data-testid={`request-outgoing-${req.id}`}
                >
                  <Avatar src={req.profile?.photoUrls?.[0]} name={req.profile?.firstName} className="h-10 w-10 text-sm" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className="truncate font-display text-[15px] font-semibold leading-tight text-gray-900">
                      {req.profile?.firstName} {req.profile?.lastName}
                    </h3>
                    {req.profile?.location && <p className="truncate text-[13px] leading-tight text-gray-600">{req.profile.location}</p>}
                  </div>
                  <span className="tag-neutral shrink-0">
                    <Clock className="h-3 w-3" />
                    {t("requestPending")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Profile of a connected mom */}
      <Drawer open={showProfileSheet && !!sheetProfile} onOpenChange={setShowProfileSheet} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[92dvh]" data-testid="connection-sheet">
          {selectedMatch && sheetProfile && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
                <PhotoCarousel
                  photos={sheetProfile.photoUrls}
                  alt={`${sheetProfile.firstName} ${sheetProfile.lastName}`}
                  className="h-64"
                  rounded="rounded-[28px]"
                />

                <div className="mt-5 px-1">
                  <DrawerTitle className="text-[26px] leading-tight tracking-[-0.02em]">
                    {sheetProfile.firstName} {sheetProfile.lastName}
                    {sheetProfile.age != null ? `, ${sheetProfile.age}` : ""}
                  </DrawerTitle>
                  <DrawerDescription className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-600">
                    <MapPin className="h-[15px] w-[15px] shrink-0" />
                    <span className="truncate">{sheetProfile.location}</span>
                  </DrawerDescription>
                  <ActivityBadge isOnline={sheetProfile.isOnline} activityBand={sheetProfile.activityBand} className="mt-3" />
                </div>

                {(sheetProfile.kidsAges.length > 0 || sheetProfile.hobbies.length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-2 px-1">
                    {sheetProfile.kidsAges.length > 0 && (
                      <span className="inline-flex h-8 items-center rounded-full bg-purple-50 px-3 text-[13px] font-semibold text-purple-700">
                        {t("kids")}: {sheetProfile.kidsAges.join(", ")}
                      </span>
                    )}
                    {sheetProfile.hobbies.map((hobby, index) => (
                      <span key={index} className="inline-flex h-8 items-center rounded-full bg-gray-100 px-3 text-[13px] font-medium text-gray-900">
                        {hobby}
                      </span>
                    ))}
                  </div>
                )}

                {sheetProfile.bio && (
                  <div className="mt-5 px-1">
                    <h3 className="section-label font-sans tracking-normal">{t("about")}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-gray-800">{sheetProfile.bio}</p>
                  </div>
                )}

                <p className="mt-5 flex items-center gap-2 px-1 text-sm text-gray-600">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {selectedMatch.acceptedAt
                      ? fill(t("chatConnectedOn"), { date: formatConnectedDate(selectedMatch.acceptedAt, language) })
                      : t("matchedRecently")}
                  </span>
                </p>

                {/* Report / block (App Store 1.2) */}
                <ReportBlockControls
                  targetUserId={sheetProfile.userId}
                  targetType="profile"
                  targetId={sheetProfile.id}
                  onBlocked={() => {
                    setShowProfileSheet(false);
                    setSelectedMatch(null);
                  }}
                  className="mt-5 border-t border-gray-100 pt-4"
                />
              </div>

              <div className="px-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] pt-2">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => startConversationMutation.mutate(selectedMatch.matchedUserId)}
                  disabled={startConversationMutation.isPending}
                  data-testid="button-message-profile"
                >
                  <MessageCircle />
                  {fill(t("chatWriteTo"), { name: sheetProfile.firstName })}
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
