import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, CalendarPlus, Check, CheckCheck, Loader2, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import type { Message, Profile, PublicProfile } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";
import { fill } from "@/lib/format";
import ReportBlockControls from "@/components/report-block";
import ActivityBadge from "@/components/activity-badge";
import PageSkeleton from "@/components/page-skeleton";

interface CurrentUser {
  id: string;
  email: string;
}

const normalizeAge = (a: string) => parseFloat(String(a).replace(",", "."));

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  // Get current user info to determine which messages are yours
  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ["/api/auth/me"],
  });
  const { data: myProfile } = useQuery<Profile>({
    queryKey: ["/api/profiles", "current-user"],
  });

  // Get messages for this match (which includes match info)
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", matchId],
    enabled: !!matchId,
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
  });

  // When did SHE last open this thread: drives the free "read" receipt
  const { data: readState } = useQuery<{ otherLastReadAt: string | null }>({
    queryKey: ["/api/conversations", matchId, "read-state"],
    enabled: !!matchId,
    refetchInterval: 5000,
  });

  // Fetching the thread marks it read server-side; refresh the list on unmount
  // so the unread dot is already gone when the user goes back.
  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    };
  }, [queryClient]);

  interface MatchWithProfile {
    id: string;
    profile: PublicProfile;
    matchedUserId: string;
    userId: string;
    acceptedAt?: string | null;
  }

  const { data: allMatches = [] } = useQuery<MatchWithProfile[]>({
    queryKey: ["/api/matches", "current-user"],
  });

  const currentMatch = allMatches.find((match) => match.id === matchId);
  const conversation = currentMatch ? {
    matchId: currentMatch.id,
    profile: currentMatch.profile,
    otherUserId: currentMatch.matchedUserId || currentMatch.userId
  } : null;

  // Icebreakers for an empty thread, built from what the two profiles share
  // (kids of the same age, a common interest, the same province) so they
  // don't read like canned lines.
  const icebreakers = useMemo(() => {
    const other = conversation?.profile;
    if (!other) return [];
    const name = other.firstName;
    const out: string[] = [];
    const myAges = (myProfile?.kidsAges ?? []).map(normalizeAge).filter((n) => !Number.isNaN(n));
    const herAges = (other.kidsAges ?? []).map(normalizeAge).filter((n) => !Number.isNaN(n));
    if (myAges.some((a) => herAges.some((b) => Math.abs(a - b) <= 1))) {
      out.push(fill(t("icebreakerKidsAge"), { name }));
    }
    const mine = new Set((myProfile?.hobbies ?? []).map((h) => h.trim().toLowerCase()));
    const shared = (other.hobbies ?? []).find((h) => mine.has(h.trim().toLowerCase()));
    if (shared) out.push(fill(t("icebreakerSharedHobby"), { name, hobby: shared }));
    if (myProfile?.location && other.location && myProfile.location === other.location) {
      out.push(fill(t("icebreakerSameProvince"), { name, province: other.location }));
    }
    out.push(fill(t("icebreakerMeetup"), { name }));
    if (out.length < 3) out.push(fill(t("icebreakerGeneric"), { name }));
    return out.slice(0, 3);
  }, [conversation?.profile, myProfile, t]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          matchId: matchId,
          senderId: "temp", // This will be overridden by backend with session userId
          content: content.trim(),
        }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const err: any = new Error(errorData.message || `Failed to send message: ${response.statusText}`);
        err.code = errorData.code;
        err.status = response.status;
        throw err;
      }

      return await response.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error: any) => {
      if (error?.status === 429) {
        toast({ title: t("rateLimitedTitle"), description: t("rateLimitedDesc"), variant: "destructive" });
      } else {
        toast({ title: t("error"), description: t("errorSendingMessage"), variant: "destructive" });
      }
      console.error("Error sending message:", error);
    },
  });

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!matchId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <h2 className="mb-4 font-display text-xl font-semibold text-gray-900">{t("invalidChat")}</h2>
          <Button onClick={() => setLocation("/messages")}>
            {t("backToMessages")}
          </Button>
        </div>
      </div>
    );
  }

  if (messagesLoading) {
    return (
      <PageSkeleton variant="chat" />
    );
  }

  const lastOwnIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (currentUser?.id && messages[i].senderId === currentUser.id) return i;
    }
    return -1;
  })();
  const otherLastReadAt = readState?.otherLastReadAt ? new Date(readState.otherLastReadAt).getTime() : 0;

  const other = conversation?.profile;
  const otherName = other?.firstName ?? "";
  const fresh = !!other?.isOnline || other?.activityBand === "today";

  // "You connected on Thursday, November 20": only when the date is known
  const connectedLabel = (() => {
    if (!currentMatch?.acceptedAt) return null;
    const date = new Date(currentMatch.acceptedAt);
    if (Number.isNaN(date.getTime())) return null;
    const sameYear = date.getFullYear() === new Date().getFullYear();
    const text =
      language === "en"
        ? format(date, sameYear ? "EEEE, MMMM d" : "MMMM d, yyyy")
        : format(date, sameYear ? "EEEE d MMMM" : "'il' d MMMM yyyy", { locale: itLocale });
    return fill(t("chatConnectedOn"), { date: text });
  })();

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50">
      {/* Header */}
      <header
        className="z-40 flex items-center gap-3 bg-gray-50/85 px-4 pb-3 backdrop-blur-xl"
        style={{ paddingTop: "calc(0.875rem + env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          className="icon-btn"
          aria-label={t("back")}
          onClick={() => setLocation("/messages")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pink-100 font-display text-base font-semibold text-gray-900 ${
              fresh ? "ring-online" : ""
            }`}
          >
            {other?.photoUrls?.[0] ? (
              <img src={other.photoUrls[0]} alt="" className="h-full w-full object-cover" />
            ) : (
              otherName.charAt(0).toUpperCase()
            )}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate font-display text-[17px] font-semibold leading-tight tracking-normal text-gray-900" data-testid="text-chat-name">
              {other?.firstName} {other?.lastName}
            </h1>
            <ActivityBadge isOnline={other?.isOnline} activityBand={other?.activityBand} variant="text" />
          </div>
        </div>

        {conversation?.otherUserId && (
          <button
            type="button"
            className="icon-btn"
            aria-label={t("chatMoreActions")}
            aria-haspopup="dialog"
            onClick={() => setMoreOpen(true)}
            data-testid="button-more"
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={2.4} />
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 pt-1">
        {connectedLabel && (
          <p className="mx-auto mb-4 mt-1 flex h-7 w-fit max-w-full items-center rounded-full bg-purple-50 px-3 text-xs font-semibold text-purple-700" data-testid="chip-connected-on">
            <span className="truncate">{connectedLabel}</span>
          </p>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center px-2 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
              <MessageCircle className="h-7 w-7 text-pink-500" strokeWidth={1.9} />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold text-gray-900">{t("startConversation")}</h2>
            <p className="mt-1.5 text-sm text-gray-600">{t("sayHello")}</p>
            {icebreakers.length > 0 && (
              <div className="mt-7 w-full space-y-2.5 text-left">
                <p className="section-label px-1">{t("icebreakersTitle")}</p>
                {icebreakers.map((text, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMessage(text)}
                    className="card-float w-full rounded-[20px] px-4 py-3.5 text-left text-[15px] leading-snug text-gray-900"
                    data-testid={`icebreaker-${i}`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, index) => {
            const isCurrentUser = currentUser?.id && msg.senderId === currentUser.id;
            const showTime = index === 0 ||
              (new Date(msg.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime()) > 300000; // 5 minutes
            const isLastOwn = index === lastOwnIndex;
            const read = isLastOwn && otherLastReadAt >= new Date(msg.createdAt).getTime();

            return (
              <div key={msg.id} data-testid={`message-${msg.id}`}>
                {showTime && (
                  <div className="mb-2.5 mt-3 text-center text-xs font-medium text-gray-500">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: language === "en" ? undefined : itLocale })}
                  </div>
                )}
                <div className={`mb-2.5 flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] ${isCurrentUser ? "text-right" : ""}`}>
                    <div
                      className={`inline-block rounded-[22px] px-4 py-3 text-left align-top text-gray-900 ${
                        isCurrentUser ? "rounded-br-md bg-pink-50" : "rounded-bl-md bg-white"
                      }`}
                    >
                      <p className="break-words text-[15px] leading-[1.45]">{msg.content}</p>
                    </div>
                    {isLastOwn && (
                      <p className="mt-1.5 flex items-center justify-end gap-1 pr-1 text-xs font-medium leading-none text-gray-600" data-testid="read-receipt">
                        {read ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        {read ? t("readReceipt") : t("sentReceipt")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2.5 px-4 pt-2 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t("typeMessage")}
          aria-label={otherName ? fill(t("chatMessageFor"), { name: otherName }) : t("typeMessage")}
          className="glass-btn h-[54px] min-w-0 flex-1 rounded-full border-0 px-5 text-base text-gray-900 outline-none placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-pink-500/40 disabled:opacity-60"
          disabled={sendMessageMutation.isPending}
          data-testid="input-message"
        />
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || sendMessageMutation.isPending}
          size="icon"
          aria-label={t("send")}
          className="h-[54px] w-[54px] shadow-[0_8px_20px_rgba(216,27,114,0.30)] [&_svg]:size-5"
          data-testid="button-send"
        >
          {sendMessageMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>

      {/* More: propose a meetup, report, block */}
      {conversation?.otherUserId && (
        <Drawer open={moreOpen} onOpenChange={setMoreOpen} shouldScaleBackground={false}>
          <DrawerContent data-testid="sheet-chat-actions">
            <div className="space-y-4 px-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] pt-5">
              <div>
                <DrawerTitle>
                  {other?.firstName} {other?.lastName}
                </DrawerTitle>
                <DrawerDescription className="mt-1 text-sm text-gray-600">{t("chatMoreActions")}</DrawerDescription>
              </div>
              <button
                type="button"
                className="flex h-14 w-full items-center gap-3 rounded-2xl bg-gray-50 px-3.5 text-left text-[15px] font-semibold text-gray-900"
                onClick={() =>
                  setLocation(
                    `/events?create=1&with=${encodeURIComponent(conversation.profile?.firstName ?? "")}&matchId=${matchId}`,
                  )
                }
                data-testid="button-propose-meetup"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-700">
                  <CalendarPlus className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                {t("proposeMeetup")}
              </button>
              <ReportBlockControls
                targetUserId={conversation.otherUserId}
                targetType="message"
                targetId={matchId}
                onBlocked={() => setLocation("/messages")}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
