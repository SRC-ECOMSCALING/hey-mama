import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import { useLocation } from "wouter";
import type { Match, Profile, Message } from "@shared/schema";
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

export default function Messages() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations", CURRENT_USER_ID],
    refetchInterval: 5000, // Refresh every 5 seconds for new messages
  });

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

      {/* Conversations List */}
      <div className="p-4 space-y-4 pb-20">
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
      </div>

      {/* Navigation */}
      <Navigation includeMarketplace={true} />
    </>
  );
}
