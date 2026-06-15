import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, ShoppingBag, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navigation from "@/components/navigation";
import { useLocation } from "wouter";
import type { Match, Profile, Message, MarketplaceItem, MarketplaceMessage } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import NotificationIcon from "@/components/notification-icon";
import { useLanguage } from "@/contexts/LanguageContext";

const CURRENT_USER_ID = "current-user";

interface Conversation {
  matchId: string;
  match: Match;
  profile: Profile;
  otherUserId: string;
  lastMessage: Message;
  messageCount: number;
}

interface MarketConversation {
  itemId: string;
  otherUserId: string;
  lastMessage: MarketplaceMessage;
  messageCount: number;
  item: MarketplaceItem | null;
  otherProfile: Profile | null;
}

export default function Messages() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations", CURRENT_USER_ID],
    refetchInterval: 5000, // Refresh every 5 seconds for new messages
  });

  const { data: marketConversations = [], isLoading: isLoadingMarket } = useQuery<MarketConversation[]>({
    queryKey: ["/api/marketplace/conversations"],
    refetchInterval: 5000,
  });

  if (isLoading && isLoadingMarket) {
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
            onClick={() => setLocation("/")}
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
          <NotificationIcon />
        </div>
      </header>

      {/* Tabs: Match chats / Market chats */}
      <div className="p-4 pb-nav">
        <Tabs defaultValue="match" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 h-11 rounded-full bg-gray-100 p-1">
            <TabsTrigger value="match" className="rounded-full" data-testid="tab-match-chats">
              <Heart className="w-4 h-4 mr-1.5" />
              Match
            </TabsTrigger>
            <TabsTrigger value="market" className="rounded-full" data-testid="tab-market-chats">
              <ShoppingBag className="w-4 h-4 mr-1.5" />
              Market
              {marketConversations.length > 0 && (
                <span className="ml-1.5 text-[10px] font-bold bg-pink-100 text-pink-600 rounded-full px-1.5 py-0.5">
                  {marketConversations.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Match conversations */}
          <TabsContent value="match" className="mt-0 space-y-4">
            {conversations.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("noConversationsYet")}</h2>
                <p className="text-gray-600">{t("startFromMatches")}</p>
                <Button
                  onClick={() => setLocation("/matches")}
                  className="mt-4"
                  style={{
                    background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {t("viewMatches")}
                </Button>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.matchId}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 cursor-pointer transition-colors"
                  style={{ backgroundColor: "var(--warm-gray)" }}
                  onClick={() => setLocation(`/chat/${conversation.matchId}`)}
                  data-testid={`conversation-${conversation.matchId}`}
                >
                  <div className="relative">
                    <img
                      src={conversation.profile?.photoUrls[0]}
                      alt={`${conversation.profile?.firstName} ${conversation.profile?.lastName}`}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    {conversation.profile?.isOnline && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-800 truncate">
                        {conversation.profile?.firstName} {conversation.profile?.lastName}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {conversation.lastMessage.content}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">
                        {conversation.messageCount} {conversation.messageCount !== 1 ? t("messages_plural") : t("message")}
                      </span>
                    </div>
                  </div>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--primary-pink)" }}></div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Market conversations */}
          <TabsContent value="market" className="mt-0 space-y-4">
            {marketConversations.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🛍️</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Nessuna chat del Market</h2>
                <p className="text-gray-600">Contatta una venditrice da un annuncio per iniziare.</p>
                <Button
                  onClick={() => setLocation("/marketplace")}
                  className="mt-4"
                  style={{
                    background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                  }}
                  data-testid="button-go-market"
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Vai al Market
                </Button>
              </div>
            ) : (
              marketConversations.map((conversation) => (
                <div
                  key={`${conversation.itemId}-${conversation.otherUserId}`}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 cursor-pointer transition-colors"
                  style={{ backgroundColor: "var(--warm-gray)" }}
                  onClick={() => setLocation(`/market-chat/${conversation.itemId}/${conversation.otherUserId}`)}
                  data-testid={`market-conversation-${conversation.itemId}-${conversation.otherUserId}`}
                >
                  <div className="relative">
                    {conversation.otherProfile?.photoUrls?.[0] ? (
                      <img
                        src={conversation.otherProfile.photoUrls[0]}
                        alt={conversation.otherProfile.firstName}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center">
                        <ShoppingBag className="w-7 h-7 text-pink-500" />
                      </div>
                    )}
                    {conversation.item?.imageUrls?.[0] && (
                      <img
                        src={conversation.item.imageUrls[0]}
                        alt={conversation.item.title}
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg object-cover border-2 border-white shadow"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-800 truncate">
                        {conversation.otherProfile
                          ? `${conversation.otherProfile.firstName} ${conversation.otherProfile.lastName}`
                          : "Utente"}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-pink-600 font-medium truncate mb-0.5">
                      📦 {conversation.item?.title ?? "Annuncio"}
                      {conversation.item ? ` · €${(conversation.item.price / 100).toFixed(0)}` : ""}
                    </p>
                    <p className="text-sm text-gray-600 truncate">
                      {conversation.lastMessage.content}
                    </p>
                  </div>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--primary-pink)" }}></div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Navigation */}
      <Navigation includeMarketplace={true} />
    </>
  );
}
