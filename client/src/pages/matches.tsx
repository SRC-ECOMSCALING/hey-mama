import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Navigation from "@/components/navigation";
import { useLocation } from "wouter";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Match, Profile } from "@shared/schema";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import { useLanguage } from "@/contexts/LanguageContext";

const CURRENT_USER_ID = "current-user";

export default function Matches() {
  const [, setLocation] = useLocation();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  interface MatchWithProfile extends Match {
    profile?: Profile;
    matchedUserId: string;
  }

  const { data: matches = [], isLoading } = useQuery<MatchWithProfile[]>({
    queryKey: ["/api/matches", CURRENT_USER_ID],
  });

  const startConversationMutation = useMutation({
    mutationFn: async (matchedUserId: string) => {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ matchedUserId }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (conversation) => {
      toast({
        title: t("conversationStarted"),
        description: t("nowSendMessages"),
      });
      // Invalidate conversations cache
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      // Navigate directly to the chat interface
      setLocation(`/chat/${conversation.matchId}`);
    },
    onError: (error) => {
      toast({
        title: t("error"),
        description: t("errorStartingConversation"),
        variant: "destructive",
      });
    },
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
        <div className="flex items-center p-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full mr-3"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <div className="text-center flex items-center">
            <img 
              src={heyMamaLogo} 
              alt="HeyMama" 
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>
      </header>

      {/* Matches List */}
      <div className="p-4 pb-nav">
        {matches.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💕</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("noMatchesYet")}</h2>
            <p className="text-gray-600">{t("keepSwiping")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-4 flex items-center space-x-4">
                  {/* Profile Image */}
                  <div 
                    className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 cursor-pointer"
                    onClick={() => {
                      setSelectedProfile(match.profile || null);
                      setShowProfileModal(true);
                    }}
                  >
                    <img
                      src={match.profile?.photoUrls[0]}
                      alt={`${match.profile?.firstName} ${match.profile?.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Profile Info */}
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setSelectedProfile(match.profile || null);
                      setShowProfileModal(true);
                    }}
                  >
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {match.profile?.firstName} {match.profile?.lastName}, {match.profile?.age}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <MapPin className="h-4 w-4" />
                      <span>{match.profile?.location}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {t("kids")}: {match.profile?.kidsAges.join(", ")}
                    </p>
                    <div className="flex gap-1">
                      {match.profile?.hobbies.slice(0, 2).map((hobby, index) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ 
                            backgroundColor: index % 2 === 0 ? "rgba(244, 166, 205, 0.2)" : "rgba(135, 206, 235, 0.2)",
                            color: index % 2 === 0 ? "var(--primary-pink)" : "var(--primary-blue)"
                          }}
                        >
                          {hobby}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Message Button */}
                  <Button
                    size="icon"
                    className="flex-shrink-0 w-12 h-12 rounded-full shadow-lg hover:scale-110 transition-transform"
                    style={{ 
                      background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                    }}
                    onClick={() => startConversationMutation.mutate(match.matchedUserId)}
                    disabled={startConversationMutation.isPending}
                    data-testid="button-message"
                  >
                    <MessageCircle className="w-5 h-5 text-white" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <Navigation includeMarketplace={true} />

      {/* Profile Details Modal */}
      {showProfileModal && selectedProfile && (
        <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
          <DialogContent className="max-w-md mx-auto max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedProfile.firstName} {selectedProfile.lastName}, {selectedProfile.age}
                <div className={`w-2 h-2 rounded-full ${
                  selectedProfile.isOnline ? 'bg-green-500' : 'bg-gray-400'
                }`} />
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Profile Image */}
              <div className="w-full h-64 rounded-lg overflow-hidden">
                <img
                  src={selectedProfile.photoUrls[0]}
                  alt={`${selectedProfile.firstName} ${selectedProfile.lastName}`}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Location */}
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">{selectedProfile.location} • {selectedProfile.distanceAway}</span>
              </div>
              
              {/* Kids Info */}
              <div className="flex flex-wrap gap-2">
                <span 
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{ 
                    backgroundColor: "rgba(244, 166, 205, 0.2)",
                    color: "var(--primary-pink)"
                  }}
                >
                  {t("kids")}: {selectedProfile.kidsAges.join(", ")}
                </span>
              </div>
              
              {/* Hobbies */}
              <div className="flex flex-wrap gap-2">
                {selectedProfile.hobbies.map((hobby, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{ 
                      backgroundColor: "rgba(135, 206, 235, 0.2)",
                      color: "var(--primary-blue)"
                    }}
                  >
                    {hobby}
                  </span>
                ))}
              </div>
              
              {/* Bio */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">{t("about")}</h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {selectedProfile.bio}
                </p>
              </div>
              
              {/* Match Date */}
              <div className="flex items-center gap-2 text-sm text-gray-500 pt-4 border-t">
                <Calendar className="h-4 w-4" />
                <span>{t("matchedRecently")}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
