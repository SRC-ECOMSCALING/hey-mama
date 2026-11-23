import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Loader2, MessageCircle, MoreHorizontal, Send, ShoppingBag, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { fill } from "@/lib/format";
import type { MarketplaceItem, MarketplaceMessage, Profile, Service } from "@shared/schema";
import ReportBlockControls from "@/components/report-block";
import PageSkeleton from "@/components/page-skeleton";

interface ThreadResponse {
  item: MarketplaceItem | null;
  service: Service | null;
  otherProfile: Profile | null;
  messages: MarketplaceMessage[];
}

interface CurrentUser {
  id: string;
  email: string;
}

export default function MarketChat() {
  const [, params] = useRoute("/market-chat/:itemId/:otherUserId");
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const [newMessage, setNewMessage] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const itemId = params?.itemId ?? "";
  const otherUserId = params?.otherUserId ?? "";

  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ["/api/auth/me"],
  });

  const { data: thread, isLoading } = useQuery<ThreadResponse>({
    queryKey: [`/api/marketplace/messages/${itemId}/${otherUserId}`],
    enabled: !!itemId && !!otherUserId,
    refetchInterval: 5000,
    staleTime: 0,
  });

  // Opening the thread marks it read server-side; refresh the list on unmount.
  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/conversations"] });
    };
  }, [queryClient]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/marketplace/messages", {
        itemId,
        otherUserId,
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: [`/api/marketplace/messages/${itemId}/${otherUserId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/conversations"] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  const handleSend = () => {
    const content = newMessage.trim();
    if (content && !sendMutation.isPending) {
      sendMutation.mutate(content);
    }
  };

  if (isLoading) {
    return <PageSkeleton variant="chat" />;
  }

  const messages = thread?.messages ?? [];
  const other = thread?.otherProfile;
  const item = thread?.item;
  const service = thread?.service;
  const otherName = other ? `${other.firstName} ${other.lastName}` : t("userFallback");
  const subjectTitle = item?.title ?? service?.title ?? t("listingFallback");
  const subjectPrice = item
    ? `€${(item.price / 100).toFixed(0)}`
    : service?.hourlyRate
      ? `€${(service.hourlyRate / 100).toFixed(0)}${t("perHour")}`
      : null;
  const subjectImage = item?.imageUrls?.[0];

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
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pink-100 font-display text-base font-semibold text-gray-900"
        >
          {other?.photoUrls?.[0] ? (
            <img src={other.photoUrls[0]} alt="" className="h-full w-full object-cover" />
          ) : other?.firstName ? (
            other.firstName.charAt(0).toUpperCase()
          ) : (
            <ShoppingBag className="h-5 w-5 text-pink-500" />
          )}
        </span>
        <h1
          className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold leading-tight tracking-normal text-gray-900"
          data-testid="text-other-name"
        >
          {otherName}
        </h1>
        {otherUserId && (
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

      {/* What the conversation is about */}
      <div className="px-4 pb-2">
        <div className="card-float flex items-center gap-3 rounded-[20px] p-2.5 pr-4">
          {subjectImage ? (
            <img src={subjectImage} alt="" className="h-11 w-11 shrink-0 rounded-[14px] object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-purple-50 text-purple-700">
              {service ? <Wrench className="h-5 w-5" strokeWidth={1.9} /> : <ShoppingBag className="h-5 w-5" strokeWidth={1.9} />}
            </span>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-3" data-testid="text-item-title">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{subjectTitle}</p>
            {subjectPrice && <p className="shrink-0 font-display text-[15px] font-semibold text-gray-900">{subjectPrice}</p>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 pt-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
              <MessageCircle className="h-7 w-7 text-pink-500" strokeWidth={1.9} />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold text-gray-900">{t("startConversation")}</h2>
            <p className="mt-1.5 text-sm text-gray-600">
              {fill(t("chatMarketEmptyHint"), {
                name: other?.firstName ?? t("chatThisPerson"),
                title: item?.title ?? service?.title ?? t("chatThisListing"),
              })}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMine = currentUser?.id && msg.senderId === currentUser.id;
            const showTime =
              index === 0 ||
              new Date(msg.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime() > 300000;

            return (
              <div key={msg.id} data-testid={`market-message-${msg.id}`}>
                {showTime && (
                  <div className="mb-2.5 mt-3 text-center text-xs font-medium text-gray-500">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: language === "en" ? undefined : itLocale })}
                  </div>
                )}
                <div className={`mb-2.5 flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] rounded-[22px] px-4 py-3 text-gray-900 ${
                      isMine ? "rounded-br-md bg-pink-50" : "rounded-bl-md bg-white"
                    }`}
                  >
                    <p className="break-words text-[15px] leading-[1.45]">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2.5 px-4 pt-2 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
        <input
          type="text"
          placeholder={t("typeMessage")}
          aria-label={other?.firstName ? fill(t("chatMessageFor"), { name: other.firstName }) : t("typeMessage")}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="glass-btn h-[54px] min-w-0 flex-1 rounded-full border-0 px-5 text-base text-gray-900 outline-none placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-pink-500/40"
          data-testid="input-market-message"
        />
        <Button
          size="icon"
          aria-label={t("send")}
          className="h-[54px] w-[54px] shrink-0 shadow-[0_8px_20px_rgba(216,27,114,0.30)] [&_svg]:size-5"
          disabled={!newMessage.trim() || sendMutation.isPending}
          onClick={handleSend}
          data-testid="button-send-market-message"
        >
          {sendMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>

      {/* More: report, block */}
      {otherUserId && (
        <Drawer open={moreOpen} onOpenChange={setMoreOpen} shouldScaleBackground={false}>
          <DrawerContent data-testid="sheet-chat-actions">
            <div className="space-y-4 px-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] pt-5">
              <div>
                <DrawerTitle>{otherName}</DrawerTitle>
                <DrawerDescription className="mt-1 text-sm text-gray-600">{t("chatMoreActions")}</DrawerDescription>
              </div>
              <ReportBlockControls
                targetUserId={otherUserId}
                targetType="message"
                targetId={itemId}
                onBlocked={() => setLocation("/messages")}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
