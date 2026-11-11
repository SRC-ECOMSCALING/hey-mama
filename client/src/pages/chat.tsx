import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Send, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("invalidChat")}</h2>
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

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50 border-b">
        <div className="flex items-center p-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full mr-3"
            onClick={() => setLocation("/messages")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src={conversation?.profile?.photoUrls[0]}
              alt={`${conversation?.profile?.firstName} ${conversation?.profile?.lastName}`}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-800 truncate" data-testid="text-chat-name">
                {conversation?.profile?.firstName} {conversation?.profile?.lastName}
              </h3>
              <ActivityBadge isOnline={conversation?.profile?.isOnline} activityBand={conversation?.profile?.activityBand} />
            </div>
          </div>

          {conversation?.otherUserId && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-pink-600"
                title={t("proposeMeetup")}
                aria-label={t("proposeMeetup")}
                onClick={() =>
                  setLocation(
                    `/events?create=1&with=${encodeURIComponent(conversation.profile?.firstName ?? "")}&matchId=${matchId}`,
                  )
                }
                data-testid="button-propose-meetup"
              >
                <CalendarPlus className="h-5 w-5" />
              </Button>
              <ReportBlockControls
                targetUserId={conversation.otherUserId}
                targetType="message"
                targetId={matchId}
                onBlocked={() => setLocation("/messages")}
                variant="icons"
              />
            </>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-2">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">{t("startConversation")}</h3>
            <p className="text-gray-600 mb-6">{t("sayHello")}</p>
            {icebreakers.length > 0 && (
              <div className="w-full space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("icebreakersTitle")}</p>
                {icebreakers.map((text, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMessage(text)}
                    className="w-full text-left text-sm rounded-2xl border border-pink-100 bg-pink-50/60 px-4 py-3 text-gray-700 hover:bg-pink-50 transition-colors"
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
                  <div className="text-center text-xs text-gray-400 mb-2">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: language === "en" ? undefined : itLocale })}
                  </div>
                )}
                <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2`}>
                  <div className={`max-w-[70%] ${isCurrentUser ? "text-right" : ""}`}>
                    <div
                      className={`px-4 py-2 rounded-2xl text-left ${
                        isCurrentUser
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                      style={isCurrentUser ? {
                        background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                      } : {}}
                    >
                      <p className="text-sm break-words">{msg.content}</p>
                    </div>
                    {isLastOwn && (
                      <p className="text-[10px] text-gray-400 mt-0.5 pr-1" data-testid="read-receipt">
                        {read ? `✓✓ ${t("readReceipt")}` : `✓ ${t("sentReceipt")}`}
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
      <div className="p-4 bg-white border-t">
        <div className="flex items-center gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t("typeMessage")}
            className="flex-1 rounded-full border-gray-200 focus:border-pink-300"
            disabled={sendMessageMutation.isPending}
            data-testid="input-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="icon"
            className="rounded-full"
            style={{
              background: message.trim()
                ? "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                : "var(--gray-300)"
            }}
            data-testid="button-send"
          >
            {sendMessageMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Send className="h-4 w-4 text-white" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
