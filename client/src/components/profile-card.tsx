import { useState } from "react";
import { Heart, X, Star, MapPin, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSwipe } from "@/hooks/use-swipe";
import UserInfoModal from "@/components/user-info-modal";
import type { Profile } from "@shared/schema";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";

interface ProfileCardProps {
  profile: Profile;
  onLike: () => void;
  onPass: () => void;
  onSuperLike: () => void;
  onNextProfile: () => void;
  onPreviousProfile: () => void;
  isLoading?: boolean;
}

export default function ProfileCard({ profile, onLike, onPass, onSuperLike, onNextProfile, onPreviousProfile, isLoading }: ProfileCardProps) {
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0, rotation: 0 });
  const [showFullBio, setShowFullBio] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  
  const photos = profile.photoUrls || [];
  const hasMultiplePhotos = photos.length > 1;
  
  const handleLike = () => {
    setShowLikeAnimation(true);
    setAnimationKey(prev => prev + 1);
    setTimeout(() => setShowLikeAnimation(false), 1000);
    onLike();
  };
  
  const { ref } = useSwipe({
    onSwipedUp: onNextProfile,
    onSwipedDown: onPreviousProfile,
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });
  
  // Handle photo swipe navigation
  const handlePhotoSwipe = {
    onSwipedLeft: () => {
      if (hasMultiplePhotos) {
        setCurrentPhotoIndex(prev => prev < photos.length - 1 ? prev + 1 : 0);
      }
    },
    onSwipedRight: () => {
      if (hasMultiplePhotos) {
        setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : photos.length - 1);
      }
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  };
  
  const { ref: photoRef } = useSwipe(handlePhotoSwipe);

  return (
    <div className="absolute inset-4 overflow-visible">
      <div
        ref={ref as any}
        className="absolute inset-0 bg-white rounded-2xl shadow-xl border-0 transform-gpu cursor-grab active:cursor-grabbing overflow-visible"
        style={{
          transform: `translate(${cardPosition.x}px, ${cardPosition.y}px) rotate(${cardPosition.rotation}deg)`,
          zIndex: 3,
        }}
      >
        <div className="relative h-full">
          {/* Photo Gallery */}
          <div 
            ref={hasMultiplePhotos ? photoRef as any : undefined}
            className="relative w-full h-full overflow-hidden rounded-2xl"
          >
            <img
              src={photos[currentPhotoIndex] || '/placeholder-profile.jpg'}
              alt={`${profile.firstName}'s photo ${currentPhotoIndex + 1}`}
              className="w-full h-full object-cover transition-opacity duration-300"
            />
            
            {/* Photo Navigation for Multiple Photos */}
            {hasMultiplePhotos && (
              <>
                {/* Left Arrow */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white/90 backdrop-blur-sm opacity-60 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : photos.length - 1);
                  }}
                  data-testid="button-prev-photo"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-700" />
                </Button>
                
                {/* Right Arrow */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white/90 backdrop-blur-sm opacity-60 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentPhotoIndex(prev => prev < photos.length - 1 ? prev + 1 : 0);
                  }}
                  data-testid="button-next-photo"
                >
                  <ChevronRight className="h-4 w-4 text-gray-700" />
                </Button>
                
                {/* Photo Dots Indicator */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.map((_, index) => (
                    <button
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all duration-200 ${
                        index === currentPhotoIndex
                          ? 'bg-white shadow-sm'
                          : 'bg-white/50 hover:bg-white/70'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhotoIndex(index);
                      }}
                      data-testid={`dot-photo-${index}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          
          {/* Distance Badge */}
          <div className={`absolute ${hasMultiplePhotos ? 'top-4 right-4' : 'top-4 right-4'} bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full z-10`}>
            <span className="text-sm font-medium text-gray-700">{profile.distanceAway}</span>
          </div>
          
          {/* Like Button - Bottom Right Corner */}
          <div className="absolute bottom-4 right-4 z-50">
            <Button
              size="icon"
              className="w-14 h-14 rounded-full shadow-lg hover:scale-110 transition-all duration-200 text-white backdrop-blur-sm"
              style={{ 
                background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
              }}
              onClick={handleLike}
              disabled={isLoading}
              data-testid="button-like-corner"
            >
              <Heart className="w-6 h-6 text-white" />
            </Button>
          </div>
          
          {/* Profile Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent rounded-b-2xl p-6">
            <div className="text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{profile.firstName}</h2>
                  <div
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseMove={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 p-0 hover:bg-white/20 rounded-full relative z-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowUserInfo(true);
                      }}
                      data-testid="button-user-info"
                    >
                      <Info className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    profile.isOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
                <span className="text-lg">{profile.age}</span>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                <span 
                  className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm text-white"
                >
                  Kids: {profile.kidsAges.join(", ")}
                </span>
                {(profile.hobbies || []).slice(0, 1).map((hobby: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm text-white"
                  >
                    {hobby}
                  </span>
                ))}
              </div>
              
              <p 
                className="text-white/90 text-sm leading-relaxed line-clamp-3 overflow-hidden cursor-pointer hover:text-white transition-colors"
                onClick={() => setShowFullBio(true)}
                title="Click to read full description"
              >
                {profile.bio}
              </p>
              
              <div className="flex items-center gap-2 mt-3">
                <MapPin className="h-4 w-4 text-white/70" />
                <span className="text-sm text-white/70">{profile.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Bio Dialog */}
      <Dialog open={showFullBio} onOpenChange={setShowFullBio}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {profile.firstName}, {profile.age}
              <div className={`w-2 h-2 rounded-full ${
                profile.isOnline ? 'bg-green-500' : 'bg-gray-400'
              }`} />
            </DialogTitle>
            <DialogDescription className="text-left">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">{profile.location} • {profile.distanceAway}</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span 
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{ 
                    backgroundColor: "rgba(244, 166, 205, 0.2)",
                    color: "var(--primary-pink)"
                  }}
                >
                  Kids: {profile.kidsAges.join(", ")}
                </span>
                {(profile.hobbies || []).slice(0, 2).map((hobby: string, index: number) => (
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
              <div className="text-gray-700 text-sm leading-relaxed">
                {profile.bio}
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* User Info Modal */}
      <UserInfoModal
        open={showUserInfo}
        onOpenChange={setShowUserInfo}
        profile={profile}
      />

      {/* Floating Hearts Animation - Fixed Position Over Everything */}
      {showLikeAnimation && (
        <div 
          key={animationKey} 
          className="fixed pointer-events-none"
          style={{
            bottom: '90px',
            right: '32px',
            zIndex: 9999
          }}
        >
          <Heart 
            className="absolute top-0 left-0 w-12 h-12 text-pink-500 fill-pink-500 opacity-0"
            style={{
              animation: 'floatUp 1s ease-out forwards'
            }}
          />
          <Heart 
            className="absolute top-0 left-0 w-10 h-10 text-pink-400 fill-pink-400 opacity-0"
            style={{
              animation: 'floatUpLeft 1s ease-out 0.1s forwards'
            }}
          />
          <Heart 
            className="absolute top-0 left-0 w-10 h-10 text-pink-400 fill-pink-400 opacity-0"
            style={{
              animation: 'floatUpRight 1s ease-out 0.15s forwards'
            }}
          />
        </div>
      )}
    </div>
  );
}