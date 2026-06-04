import { Button } from "@/components/ui/button";
import type { Profile } from "@shared/schema";

interface MatchModalProps {
  profile: Profile;
  onClose: () => void;
  onMessage: () => void;
}

export default function MatchModal({ profile, onClose, onMessage }: MatchModalProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
         style={{ 
           background: "linear-gradient(to bottom right, rgba(244, 166, 205, 0.9), rgba(255, 143, 163, 0.9))"
         }}>
      <div className="bg-white rounded-3xl p-8 mx-6 text-center shadow-2xl">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">It's a Match!</h2>
        <p className="text-gray-600 mb-6">You and {profile.name} both want to connect!</p>
        <div className="flex gap-3">
          <Button
            className="flex-1 py-3 px-6 rounded-full font-medium text-white"
            style={{ 
              background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
            }}
            onClick={onMessage}
          >
            Send Message
          </Button>
          <Button
            variant="secondary"
            className="flex-1 py-3 px-6 rounded-full font-medium"
            onClick={onClose}
          >
            Keep Swiping
          </Button>
        </div>
      </div>
    </div>
  );
}