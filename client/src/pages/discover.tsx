import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import MatchModal from "@/components/match-modal";
import ServicesModal from "@/components/services-modal";
import SettingsModal from "@/components/settings-modal";
import Navigation from "@/components/navigation";
import NotificationIcon from "@/components/notification-icon";
import {
  Settings,
  Heart,
  X,
  MapPin,
  Users,
  Baby,
  Trees,
  Star,
  BookOpen,
  Palette,
  Waves,
  Utensils,
  Coffee,
  ShoppingBag,
  Theater,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Profile, Location } from "@shared/schema";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import { useLanguage } from "@/contexts/LanguageContext";

// Category icon and color mapping
const getCategoryStyle = (category: string) => {
  const styles = {
    parco: {
      Icon: Trees,
      bgColor: "bg-green-600",
      borderColor: "border-green-900",
    },
    biblioteca: {
      Icon: BookOpen,
      bgColor: "bg-purple-600",
      borderColor: "border-purple-800",
    },
    museo: {
      Icon: Palette,
      bgColor: "from-purple-500",
      borderColor: "border-purple-600",
    },
    playground: {
      Icon: Baby,
      bgColor: "bg-yellow-500",
      borderColor: "border-yellow-600",
    },
    piscina: {
      Icon: Waves,
      bgColor: "bg-blue-500",
      borderColor: "border-blue-600",
    },
    ristorante: {
      Icon: Utensils,
      bgColor: "bg-red-500",
      borderColor: "border-red-600",
    },
    cafe: {
      Icon: Coffee,
      bgColor: "bg-orange-500",
      borderColor: "border-orange-600",
    },
    "centro-commerciale": {
      Icon: ShoppingBag,
      bgColor: "bg-pink-500",
      borderColor: "border-pink-600",
    },
    teatro: {
      Icon: Theater,
      bgColor: "bg-indigo-500",
      borderColor: "border-indigo-600",
    },
  };

  // Categories are stored in different shapes ("parco" from the admin CSV,
  // "Parco" from the OSM import, "Parco Giochi" from user submissions):
  // normalize and alias them so every park gets the green tree marker etc.
  const aliases: Record<string, keyof typeof styles> = {
    parco: "parco",
    park: "parco",
    "parco giochi": "playground",
    playground: "playground",
    biblioteca: "biblioteca",
    library: "biblioteca",
    museo: "museo",
    "caffè": "cafe",
    caffe: "cafe",
    cafe: "cafe",
    "café": "cafe",
    piscina: "piscina",
    "parco acquatico": "piscina",
    "water park": "piscina",
    ristorante: "ristorante",
    ristoranti: "ristorante",
    restaurants: "ristorante",
    "centro-commerciale": "centro-commerciale",
    "centro attività": "playground",
    "activity center": "playground",
    teatro: "teatro",
  };

  const normalized = aliases[category.trim().toLowerCase()];
  return (
    (normalized && styles[normalized]) || {
      Icon: MapPin,
      bgColor: "bg-gray-500",
      borderColor: "border-gray-600",
    }
  );
};

const CURRENT_USER_ID = "current-user";
const DEFAULT_CENTER = { lat: 41.9028, lng: 12.4964 }; // Rome, Italy as default
const DEFAULT_ZOOM = 11;
const MAP_POSITION_KEY = "heymama_map_position";

interface SwipeResponse {
  swipe: any;
  match: any | null;
}

interface LocationWithReviews extends Location {
  reviewCount: number;
}

interface SavedMapPosition {
  center: { lat: number; lng: number };
  zoom: number;
}

export default function Discover() {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationWithReviews | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Load saved map position from localStorage
  const getSavedMapPosition = (): SavedMapPosition => {
    try {
      const saved = localStorage.getItem(MAP_POSITION_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error("Error loading saved map position:", error);
    }
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  };

  const savedPosition = getSavedMapPosition();
  const [mapCenter, setMapCenter] = useState(savedPosition.center);
  const [mapZoom, setMapZoom] = useState(savedPosition.zoom);
  const [swipeStates, setSwipeStates] = useState<
    Record<string, "liked" | "passed" | "matched">
  >({});
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: profiles = [], isLoading } = useQuery<Profile[]>({
    queryKey: ["/api/profiles/map"],
  });

  // Fetch locations from database
  const { data: locations = [] } = useQuery<LocationWithReviews[]>({
    queryKey: ["/api/locations"],
  });

  // Fetch reviews for selected location
  const { data: locationReviews = [] } = useQuery<any[]>({
    queryKey: ["/api/locations", selectedLocation?.id, "reviews"],
    enabled: !!selectedLocation?.id,
  });

  // Save map position to localStorage
  const saveMapPosition = () => {
    try {
      const position: SavedMapPosition = {
        center: mapCenter,
        zoom: mapZoom,
      };
      localStorage.setItem(MAP_POSITION_KEY, JSON.stringify(position));
    } catch (error) {
      console.error("Error saving map position:", error);
    }
  };

  // Save map position when component unmounts or page closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveMapPosition();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      saveMapPosition();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [mapCenter, mapZoom]);

  // Update user activity every 30 seconds to keep them online
  useEffect(() => {
    const updateActivity = () => {
      apiRequest("POST", `/api/users/${CURRENT_USER_ID}/activity`);
    };

    updateActivity();
    const interval = setInterval(updateActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  // Refresh profiles periodically to show updated online statuses
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: ["/api/profiles/discover", CURRENT_USER_ID],
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Set map center to first profile with coordinates only if no saved position
  useEffect(() => {
    const hasSavedPosition = localStorage.getItem(MAP_POSITION_KEY);
    if (!hasSavedPosition) {
      const profileWithCoords = profiles.find((p) => p.latitude && p.longitude);
      if (
        profileWithCoords &&
        profileWithCoords.latitude &&
        profileWithCoords.longitude
      ) {
        setMapCenter({
          lat: parseFloat(profileWithCoords.latitude),
          lng: parseFloat(profileWithCoords.longitude),
        });
      }
    }
  }, [profiles]);

  const swipeMutation = useMutation({
    mutationFn: async ({
      targetUserId,
      isLike,
    }: {
      targetUserId: string;
      isLike: boolean;
    }) => {
      const response = await apiRequest("POST", "/api/swipes", {
        userId: CURRENT_USER_ID,
        targetUserId,
        isLike,
      });
      return response.json() as Promise<SwipeResponse>;
    },
    onSuccess: (data, variables) => {
      // Update swipe state
      if (data.match) {
        setSwipeStates((prev) => ({
          ...prev,
          [variables.targetUserId]: "matched",
        }));
        const matchedUser = profiles.find(
          (p) => p.id === variables.targetUserId,
        );
        if (matchedUser) {
          setMatchedProfile(matchedUser);
          setShowMatchModal(true);
        }
      } else {
        setSwipeStates((prev) => ({
          ...prev,
          [variables.targetUserId]: variables.isLike ? "liked" : "passed",
        }));
      }
      setSelectedProfile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/discover"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/users", CURRENT_USER_ID, "swipe-status"],
      });
    },
    onError: (error: any) => {
      if (error.status === 429) {
        toast({
          title: t("dailyLimitReached"),
          description: t("dailyLimitMessage"),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("error"),
          description: t("swipeError"),
          variant: "destructive",
        });
      }
    },
  });

  const handleLike = (profile: Profile) => {
    swipeMutation.mutate({
      targetUserId: profile.id,
      isLike: true,
    });
  };

  // Submit review mutation
  const reviewMutation = useMutation({
    mutationFn: async (reviewData: {
      locationId: string;
      userId: string;
      rating: number;
      comment: string;
      visitedWith: string;
    }) => {
      const response = await apiRequest("POST", "/api/reviews", reviewData);
      return response.json();
    },
    onSuccess: () => {
      setShowReviewModal(false);
      setReviewRating(0);
      setReviewComment("");
      toast({
        title: "Recensione inviata!",
        description: "Grazie per aver condiviso la tua esperienza.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/locations", selectedLocation?.id, "reviews"],
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Non è stato possibile inviare la recensione.",
        variant: "destructive",
      });
    },
  });

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");

  const handleSubmitReview = () => {
    if (!selectedLocation?.id || reviewRating === 0 || !reviewComment.trim()) {
      toast({
        title: "Campi mancanti",
        description: "Per favore completa tutti i campi.",
        variant: "destructive",
      });
      return;
    }

    reviewMutation.mutate({
      locationId: selectedLocation.id,
      userId: CURRENT_USER_ID,
      rating: reviewRating,
      comment: reviewComment,
      visitedWith: "Con i miei bambini",
    });
  };

  const handlePass = (profile: Profile) => {
    swipeMutation.mutate({
      targetUserId: profile.id,
      isLike: false,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-pink"></div>
      </div>
    );
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Filter profiles that have coordinates
  const profilesWithCoords = profiles.filter((p) => p.latitude && p.longitude);

  return (
    <>
      {/* Map Content */}
      <main className="relative h-[100dvh] overflow-hidden bg-white">
        {/* Header - Floating on top of map */}
        <header className="absolute left-4 right-4 bg-white shadow-lg rounded-2xl z-50 top-[calc(1rem_+_env(safe-area-inset-top))]">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setShowSettingsModal(true)}
              data-testid="button-settings"
            >
              <Settings className="h-5 w-5 text-gray-600" />
            </Button>
            <div className="text-center flex items-center">
              <img
                src={heyMamaLogo}
                alt="HeyMama"
                className="h-10 w-auto object-contain"
              />
            </div>
            <NotificationIcon />
          </div>
        </header>

        {profilesWithCoords.length === 0 ? (
          <div className="flex items-center justify-center h-full px-6 bg-white">
            <div className="text-center">
              <div className="text-6xl mb-4">📍</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {t("noMoreProfiles")}
              </h2>
              <p className="text-gray-600">{t("checkBackLater")}</p>
            </div>
          </div>
        ) : (
          <APIProvider apiKey={apiKey} libraries={["places"]}>
            <Map
              style={{ width: "100%", height: "100%" }}
              defaultCenter={mapCenter}
              defaultZoom={mapZoom}
              maxZoom={15}
              minZoom={5}
              gestureHandling="greedy"
              disableDefaultUI={true}
              streetViewControl={false}
              mapTypeControl={false}
              zoomControl={true}
              fullscreenControl={false}
              mapId="cb6dc0b32328db269be352c6"
              options={{
                clickableIcons: false,
              }}
              onCameraChanged={(ev) => {
                if (ev.detail.center && ev.detail.zoom) {
                  setMapCenter(ev.detail.center);
                  setMapZoom(ev.detail.zoom);
                }
              }}
              onClick={() => {
                setSelectedProfile(null);
                setSelectedLocation(null);
              }}
            >
              {profilesWithCoords.map((profile) => {
                const swipeState = swipeStates[profile.id];
                const markerBgColor =
                  swipeState === "matched"
                    ? "bg-pink-500"
                    : swipeState === "liked"
                      ? "bg-pink-100"
                      : "bg-white";
                const borderColor =
                  swipeState === "matched"
                    ? "border-pink-600"
                    : swipeState === "liked"
                      ? "border-pink-300"
                      : "border-pink-200";
                const logoFilter =
                  swipeState === "passed" ? "grayscale(100%)" : "none";

                return (
                  <AdvancedMarker
                    key={profile.id}
                    position={{
                      lat: parseFloat(profile.latitude!),
                      lng: parseFloat(profile.longitude!),
                    }}
                    onClick={() => setSelectedProfile(profile)}
                    zIndex={100}
                  >
                    <div className="relative">
                      <div
                        className={`w-12 h-12 ${markerBgColor} rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-all duration-300 border-2 ${borderColor}`}
                      >
                        <img
                          src={heyMamaLogo}
                          alt="HeyMama"
                          className="w-8 h-8 object-contain transition-all duration-300"
                          style={{ filter: logoFilter }}
                        />
                      </div>
                      {profile.isOnline && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                  </AdvancedMarker>
                );
              })}

              {selectedProfile && (
                <InfoWindow
                  position={{
                    lat: parseFloat(selectedProfile.latitude!),
                    lng: parseFloat(selectedProfile.longitude!),
                  }}
                  onCloseClick={() => setSelectedProfile(null)}
                  maxWidth={350}
                >
                  <div className="p-2 relative">
                    {/* Close Button */}
                    <button
                      onClick={() => setSelectedProfile(null)}
                      className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors z-10"
                      data-testid="button-close-profile-popup"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>

                    {/* Profile Image */}
                    <div className="relative mb-3">
                      <img
                        src={selectedProfile.photoUrls[0]}
                        alt={selectedProfile.firstName}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      {selectedProfile.isOnline && (
                        <Badge className="absolute top-2 right-2 bg-green-500 text-white border-0">
                          Online
                        </Badge>
                      )}
                    </div>

                    {/* Profile Info */}
                    <div className="mb-3">
                      <h3 className="text-xl font-bold text-gray-800">
                        {selectedProfile.firstName}{selectedProfile.age != null ? `, ${selectedProfile.age}` : ""}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                        <MapPin className="w-4 h-4" />
                        {selectedProfile.distanceAway}
                      </div>
                    </div>

                    {/* Kids Info */}
                    <div className="flex items-center gap-2 mb-3 text-sm text-gray-700">
                      <Baby className="w-4 h-4 text-pink-500" />
                      <span>
                        {selectedProfile.kidsNumber}{" "}
                        {selectedProfile.kidsNumber === 1
                          ? t("child")
                          : t("children")}
                      </span>
                      {selectedProfile.kidsAges.length > 0 && (
                        <span className="text-gray-500">
                          • {selectedProfile.kidsAges.join(", ")}
                        </span>
                      )}
                    </div>

                    {/* Bio */}
                    <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                      {selectedProfile.bio}
                    </p>

                    {/* Hobbies */}
                    {selectedProfile.hobbies &&
                      selectedProfile.hobbies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {selectedProfile.hobbies
                            .slice(0, 5)
                            .map((hobby, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="text-xs bg-pink-50 text-pink-700 border border-pink-200"
                              >
                                {hobby}
                              </Badge>
                            ))}
                        </div>
                      )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 justify-center">
                      <Button
                        onClick={() => handlePass(selectedProfile)}
                        disabled={swipeMutation.isPending}
                        variant="outline"
                        size="lg"
                        className="flex-1 rounded-full border-2 border-gray-300 hover:border-gray-400"
                        data-testid="button-pass"
                      >
                        <X className="w-6 h-6 text-gray-600" />
                      </Button>
                      <Button
                        onClick={() => handleLike(selectedProfile)}
                        disabled={swipeMutation.isPending}
                        size="lg"
                        className="flex-1 rounded-full"
                        style={{
                          background:
                            "linear-gradient(to right, var(--primary-pink), var(--accent-coral))",
                        }}
                        data-testid="button-like"
                      >
                        <Heart className="w-6 h-6 text-white fill-white" />
                      </Button>
                    </div>
                  </div>
                </InfoWindow>
              )}

              {/* Database Location Markers */}
              {locations.map((location) => {
                const coords = location.coordinates.split(",");
                const lat = parseFloat(coords[0]);
                const lng = parseFloat(coords[1]);
                const { Icon, bgColor, borderColor } = getCategoryStyle(
                  location.category,
                );

                return (
                  <AdvancedMarker
                    key={location.id}
                    position={{ lat, lng }}
                    onClick={() => setSelectedLocation(location)}
                    zIndex={1}
                  >
                    <div
                      className={`w-7 h-7 ${bgColor} rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 ${borderColor}`}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                  </AdvancedMarker>
                );
              })}

              {/* Location Info Window */}
              {selectedLocation &&
                (() => {
                  const coords = selectedLocation.coordinates.split(",");
                  const lat = parseFloat(coords[0]);
                  const lng = parseFloat(coords[1]);

                  return (
                    <InfoWindow
                      position={{ lat, lng }}
                      onCloseClick={() => setSelectedLocation(null)}
                      maxWidth={350}
                    >
                      <div className="p-2 relative">
                        {/* Close Button */}
                        <button
                          onClick={() => setSelectedLocation(null)}
                          className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors z-10"
                          data-testid="button-close-location-popup"
                        >
                          <X className="w-4 h-4 text-gray-600" />
                        </button>

                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                          {selectedLocation.name}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                          <MapPin className="w-4 h-4" />
                          {selectedLocation.address}
                        </div>
                        {selectedLocation.rating > 0 && (
                          <div className="flex items-center gap-1 mb-3">
                            <span className="text-yellow-500">★</span>
                            <span className="text-sm font-semibold">
                              {selectedLocation.rating}/5
                            </span>
                          </div>
                        )}

                        <div className="space-y-2 mt-4">
                          <h4 className="font-semibold text-sm">
                            Recensioni HeyMama
                          </h4>
                          {locationReviews.length > 0 ? (
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {locationReviews
                                .slice(0, 3)
                                .map((review: any) => (
                                  <div
                                    key={review.id}
                                    className="text-xs border-b pb-2 last:border-0"
                                  >
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className="text-yellow-500">★</span>
                                      <span className="font-semibold">
                                        {review.rating}/5
                                      </span>
                                      <span className="text-gray-500">
                                        • {review.profile?.name}
                                      </span>
                                    </div>
                                    <p className="text-gray-700 line-clamp-2">
                                      {review.comment}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">
                              Nessuna recensione ancora
                            </p>
                          )}

                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                const mapsUrl =
                                  selectedLocation.googleMapsUrl ||
                                  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                                window.open(mapsUrl, "_blank");
                              }}
                              data-testid="button-open-maps"
                            >
                              Apri in Maps
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              style={{
                                background:
                                  "linear-gradient(to right, var(--primary-pink), var(--accent-coral))",
                              }}
                              onClick={() => setShowReviewModal(true)}
                              data-testid="button-add-review"
                            >
                              Inserisci recensione
                            </Button>
                          </div>
                        </div>
                      </div>
                    </InfoWindow>
                  );
                })()}
            </Map>
          </APIProvider>
        )}
      </main>

      {/* Navigation */}
      <Navigation includeMarketplace={true} />

      {/* Match Modal */}
      {showMatchModal && matchedProfile && (
        <MatchModal
          profile={matchedProfile}
          onClose={() => setShowMatchModal(false)}
          onMessage={() => {
            setShowMatchModal(false);
          }}
        />
      )}

      {/* Services Modal */}
      {showServicesModal && (
        <ServicesModal onClose={() => setShowServicesModal(false)} />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lascia una recensione</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Valutazione
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="focus:outline-none"
                    data-testid={`star-${star}`}
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= reviewRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                La tua recensione
              </label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Raccontaci la tua esperienza in questo parco..."
                rows={4}
                data-testid="input-review-comment"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewRating(0);
                  setReviewComment("");
                }}
                data-testid="button-cancel-review"
              >
                Annulla
              </Button>
              <Button
                className="flex-1"
                style={{
                  background:
                    "linear-gradient(to right, var(--primary-pink), var(--accent-coral))",
                }}
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending}
                data-testid="button-submit-review"
              >
                {reviewMutation.isPending ? "Invio..." : "Invia recensione"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
