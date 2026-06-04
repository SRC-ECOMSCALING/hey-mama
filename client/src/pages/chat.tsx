import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Send, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Message, Profile } from "@shared/schema";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import { useLanguage } from "@/contexts/LanguageContext";

interface CurrentUser {
  id: string;
  email: string;
}

interface Conversation {
  matchId: string;
  profile: Profile;
  otherUserId: string;
}

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Get current user info to determine which messages are yours
  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ["/api/auth/me"],
  });

  // Get messages for this match (which includes match info)
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", matchId],
    enabled: !!matchId,
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
  });

  // Get match info for the conversation header - using the matches endpoint to find this specific match
  interface MatchWithProfile {
    id: string;
    profile: Profile;
    matchedUserId: string;
    userId: string;
  }

  const { data: allMatches = [] } = useQuery<MatchWithProfile[]>({
    queryKey: ["/api/matches", "current-user"],
  });

  // Find the current match from all matches
  const currentMatch = allMatches.find((match) => match.id === matchId);
  const conversation = currentMatch ? {
    matchId: currentMatch.id,
    profile: currentMatch.profile,
    otherUserId: currentMatch.matchedUserId || currentMatch.userId
  } : null;


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
        throw new Error(errorData.message || `Failed to send message: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      setMessage("");
      // Invalidate messages to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
      // Also invalidate conversations to update last message
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error) => {
      toast({
        title: t("error"),
        description: t("errorSendingMessage"),
        variant: "destructive",
      });
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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-pink"></div>
      </div>
    );
  }

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
          
          <div className="flex items-center gap-3 flex-1">
            <img
              src={conversation?.profile?.photoUrls[0]}
              alt={`${conversation?.profile?.firstName} ${conversation?.profile?.lastName}`}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h3 className="font-semibold text-gray-800" data-testid="text-chat-name">
                {conversation?.profile?.firstName} {conversation?.profile?.lastName}
              </h3>
              <p className="text-sm text-gray-600">
                {conversation?.profile?.isOnline ? t("online") : t("offline")}
              </p>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" className="rounded-full">
            <Heart className="h-5 w-5 text-pink-500" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">{t("startConversation")}</h3>
            <p className="text-gray-600 mb-4">{t("sayHello")}</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isCurrentUser = currentUser?.id && msg.senderId === currentUser.id;
            const showTime = index === 0 || 
              (new Date(msg.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime()) > 300000; // 5 minutes

            return (
              <div key={msg.id} data-testid={`message-${msg.id}`}>
                {showTime && (
                  <div className="text-center text-xs text-gray-400 mb-2">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </div>
                )}
                <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2`}>
                  <div 
                    className={`max-w-[70%] px-4 py-2 rounded-2xl ${
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