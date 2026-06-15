import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Send, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import type { MarketplaceItem, MarketplaceMessage, Profile } from "@shared/schema";

interface ThreadResponse {
  item: MarketplaceItem | null;
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
  const [newMessage, setNewMessage] = useState("");
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
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  const messages = thread?.messages ?? [];
  const other = thread?.otherProfile;
  const item = thread?.item;

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50 safe-top">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shrink-0"
            onClick={() => setLocation("/messages")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          {other?.photoUrls?.[0] ? (
            <img
              src={other.photoUrls[0]}
              alt={other.firstName}
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-pink-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 truncate" data-testid="text-other-name">
              {other ? `${other.firstName} ${other.lastName}` : "Utente"}
            </h2>
            <p className="text-xs text-gray-500 truncate" data-testid="text-item-title">
              {item ? `📦 ${item.title} · €${(item.price / 100).toFixed(0)}` : "Annuncio"}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="text-5xl mb-3">💬</div>
            <p className="text-gray-700 font-medium mb-1">Inizia la conversazione</p>
            <p className="text-gray-500 text-sm">
              Scrivi a {other?.firstName ?? "questa mamma"} per "{item?.title ?? "questo annuncio"}"
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
                  <div className="text-center text-xs text-gray-400 mb-2">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </div>
                )}
                <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2`}>
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                      isMine ? "text-white" : "bg-white text-gray-800 shadow-sm"
                    }`}
                    style={isMine ? { background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" } : {}}
                  >
                    <p className="text-sm break-words">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 p-3 safe-bottom">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Scrivi un messaggio…"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="h-11 rounded-full bg-gray-100 border-0 flex-1"
            data-testid="input-market-message"
          />
          <Button
            size="icon"
            className="h-11 w-11 rounded-full shrink-0 text-white"
            style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
            disabled={!newMessage.trim() || sendMutation.isPending}
            onClick={handleSend}
            data-testid="button-send-market-message"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
