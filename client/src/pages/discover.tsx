import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fill } from "@/lib/format";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import {
  X,
  MapPin,
  UserPlus,
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
  CalendarDays,
  Users,
  Clock,
  Loader2,
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
import type { PublicProfile, Location } from "@shared/schema";
import type { TranslationKey } from "@/lib/translations";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import { useLanguage } from "@/contexts/LanguageContext";
import PageSkeleton from "@/components/page-skeleton";
import AppHeader from "@/components/app-header";
import ActivityBadge from "@/components/activity-badge";
import PhotoCarousel from "@/components/photo-carousel";
import ReportBlockControls from "@/components/report-block";

// Category icon and color mapping
const getCategoryStyle = (category: string) => {
  const styles = {
    parco: { Icon: Trees, bgColor: "bg-green-600", borderColor: "border-green-900" },
    biblioteca: { Icon: BookOpen, bgColor: "bg-purple-600", borderColor: "border-purple-800" },
    museo: { Icon: Palette, bgColor: "from-purple-500", borderColor: "border-purple-600" },
    playground: { Icon: Baby, bgColor: "bg-yellow-500", borderColor: "border-yellow-600" },
    piscina: { Icon: Waves, bgColor: "bg-blue-500", borderColor: "border-blue-600" },
    ristorante: { Icon: Utensils, bgColor: "bg-red-500", borderColor: "border-red-600" },
    cafe: { Icon: Coffee, bgColor: "bg-orange-500", borderColor: "border-orange-600" },
    "centro-commerciale": { Icon: ShoppingBag, bgColor: "bg-pink-500", borderColor: "border-pink-600" },
    teatro: { Icon: Theater, bgColor: "bg-indigo-500", borderColor: "border-indigo-600" },
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
const AGE_FILTER_KEY = "heymama.kidsAgeFilter";

// Kids' age filter: coarse bands, overlapping on purpose at the boundaries
// (a 3-year-old is both "1–3" and "3–5"), which is how parents think.
type AgeBand = "all" | "0to1" | "1to3" | "3to5" | "6plus";
const AGE_BANDS: { key: AgeBand; label: TranslationKey }[] = [
  { key: "all", label: "ageBandAll" },
  { key: "0to1", label: "ageBand0to1" },
  { key: "1to3", label: "ageBand1to3" },
  { key: "3to5", label: "ageBand3to5" },
  { key: "6plus", label: "ageBand6plus" },
];
const matchesAgeBand = (ages: string[] | null | undefined, band: AgeBand): boolean => {
  if (band === "all") return true;
  return (ages ?? []).some((a) => {
    const n = parseFloat(String(a).replace(",", "."));
    if (Number.isNaN(n)) return false;
    switch (band) {
      case "0to1": return n <= 1;
      case "1to3": return n >= 1 && n <= 3;
      case "3to5": return n >= 3 && n <= 5;
      case "6plus": return n >= 6;
    }
  });
};

interface LocationWithReviews extends Location {
  reviewCount: number;
}

interface SavedMapPosition {
  center: { lat: number; lng: number };
  zoom: number;
}

interface CommunityStats {
  province: string;
  totalMoms: number;
  activeMoms14d: number;
  openThreshold: number;
  isOpenZone: boolean;
}

interface MapEvent {
  id: string;
  title: string;
  eventDate: string;
  location: string;
  latitude: string | null;
  longitude: string | null;
  status: string;
  isOwn: boolean;
  creatorName: string;
  creatorIsProfessional?: boolean;
  rsvp: { going: number; maybe: number; mine: string | null };
}

// apiRequest throws `Error("<status>: <json body>")`: recover the status and
// the server's error code so the UI can say the right thing.
const parseApiError = (error: any): { status: number; code?: string } => {
  const m = String(error?.message || "");
  const sep = m.indexOf(":");
  const status = parseInt(m.slice(0, sep), 10);
  let code: string | undefined;
  try {
    code = JSON.parse(m.slice(sep + 1).trim()).code;
  } catch {
    /* non-JSON body */
  }
  return { status: Number.isNaN(status) ? 0 : status, code };
};

export default function Discover() {
  const [, setLocation] = useLocation();
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithReviews | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [connectTarget, setConnectTarget] = useState<PublicProfile | null>(null);
  const [connectMessage, setConnectMessage] = useState("");
  const [ageBand, setAgeBand] = useState<AgeBand>(() => {
    try {
      const saved = localStorage.getItem(AGE_FILTER_KEY) as AgeBand | null;
      return saved && AGE_BANDS.some((b) => b.key === saved) ? saved : "all";
    } catch {
      return "all";
    }
  });

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
  const [requestStates, setRequestStates] = useState<Record<string, "requested" | "connected">>({});
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: profiles = [], isLoading } = useQuery<PublicProfile[]>({
    queryKey: ["/api/profiles/map"],
  });

  // Professional accounts don't connect with moms: they see places only.
  const isProfessional = user?.accountType === "professional";
  const myProvince = user?.province ?? null;

  // Honest density: how many moms are really around (last two weeks)
  const { data: community } = useQuery<CommunityStats>({
    queryKey: [`/api/community/stats?province=${encodeURIComponent(myProvince ?? "")}`],
    enabled: !!myProvince && !isProfessional,
    staleTime: 5 * 60 * 1000,
  });

  // Real connection status per user id: 'connected' | 'pending_sent' | 'pending_received' | 'cooldown'
  const { data: connectionStatus = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/connections/status"],
  });

  // Fetch locations from database
  const { data: locations = [] } = useQuery<LocationWithReviews[]>({
    queryKey: ["/api/locations"],
  });

  // Upcoming events with a pin go on the map too
  const { data: events = [] } = useQuery<MapEvent[]>({
    queryKey: ["/api/events"],
    enabled: !isProfessional,
  });
  const mapEvents = useMemo(() => {
    const now = Date.now();
    return events.filter(
      (e) => e.status === "approved" && e.latitude && e.longitude && new Date(e.eventDate).getTime() >= now - 3 * 60 * 60 * 1000,
    );
  }, [events]);

  // Fetch reviews for selected location
  const { data: locationReviews = [] } = useQuery<any[]>({
    queryKey: ["/api/locations", selectedLocation?.id, "reviews"],
    enabled: !!selectedLocation?.id,
  });

  // Save map position to localStorage
  const saveMapPosition = () => {
    try {
      localStorage.setItem(MAP_POSITION_KEY, JSON.stringify({ center: mapCenter, zoom: mapZoom }));
    } catch (error) {
      console.error("Error saving map position:", error);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => saveMapPosition();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      saveMapPosition();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [mapCenter, mapZoom]);

  useEffect(() => {
    try {
      localStorage.setItem(AGE_FILTER_KEY, ageBand);
    } catch {
      /* storage unavailable */
    }
  }, [ageBand]);

  // Update user activity every 30 seconds to keep them online
  useEffect(() => {
    const updateActivity = () => {
      apiRequest("POST", `/api/users/${CURRENT_USER_ID}/activity`).catch(() => {});
    };
    updateActivity();
    const interval = setInterval(updateActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  // Refresh the map profiles periodically to show updated activity
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/map"] });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Set map center to first profile with coordinates only if no saved position
  useEffect(() => {
    const hasSavedPosition = localStorage.getItem(MAP_POSITION_KEY);
    if (!hasSavedPosition) {
      const profileWithCoords = profiles.find((p) => p.latitude && p.longitude);
      if (profileWithCoords?.latitude && profileWithCoords.longitude) {
        setMapCenter({
          lat: parseFloat(profileWithCoords.latitude),
          lng: parseFloat(profileWithCoords.longitude),
        });
      }
    }
  }, [profiles]);

  const invalidateConnections = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/profiles/map"] });
    queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    queryClient.invalidateQueries({ queryKey: ["/api/connections/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/connections/requests"] });
  };

  // A connection request (with an optional note). It connects immediately
  // only when the other mom had already asked us.
  const requestMutation = useMutation({
    mutationFn: async ({ targetUserId, message }: { targetUserId: string; profileId: string; message?: string }) => {
      const response = await apiRequest("POST", "/api/swipes", {
        targetUserId,
        message: message?.trim() || undefined,
      });
      return response.json() as Promise<{ connected: boolean; requested: boolean }>;
    },
    onSuccess: (data, variables) => {
      const other = profiles.find((p) => p.id === variables.profileId);
      setRequestStates((prev) => ({
        ...prev,
        [variables.profileId]: data.connected ? "connected" : "requested",
      }));
      setConnectTarget(null);
      setConnectMessage("");
      setSelectedProfile(null);
      toast(
        data.connected
          ? { title: t("connectedTitle"), description: fill(t("connectedDesc"), { name: other?.firstName || "" }) }
          : { title: t("requestSentTitle"), description: fill(t("requestSentDesc"), { name: other?.firstName || "" }) },
      );
      invalidateConnections();
    },
    onError: (error: any) => {
      const { status, code } = parseApiError(error);
      if (status === 429 && code === "declined_recently") {
        toast({ title: t("requestNotAvailable"), description: t("requestNotAvailableDesc") });
      } else if (status === 429) {
        toast({ title: t("rateLimitedTitle"), description: t("rateLimitedDesc"), variant: "destructive" });
      } else {
        toast({ title: t("error"), description: t("swipeError"), variant: "destructive" });
      }
      setConnectTarget(null);
      invalidateConnections();
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: "going" | "maybe" }) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/rsvp`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setSelectedEvent(null);
      toast({ title: t("rsvpYouGoing") });
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  // Submit review mutation
  const reviewMutation = useMutation({
    mutationFn: async (reviewData: { locationId: string; rating: number; comment: string; visitedWith: string }) => {
      const response = await apiRequest("POST", "/api/reviews", reviewData);
      return response.json();
    },
    onSuccess: () => {
      setShowReviewModal(false);
      setReviewRating(0);
      setReviewComment("");
      toast({ title: t("reviewSent"), description: t("reviewSentDescription") });
      queryClient.invalidateQueries({ queryKey: ["/api/locations", selectedLocation?.id, "reviews"] });
    },
    onError: () => {
      toast({ title: t("error"), description: t("reviewSendFailedShort"), variant: "destructive" });
    },
  });

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");

  const handleSubmitReview = () => {
    if (!selectedLocation?.id || reviewRating === 0 || !reviewComment.trim()) {
      toast({ title: t("missingFields"), description: t("fillAllFields"), variant: "destructive" });
      return;
    }
    reviewMutation.mutate({
      locationId: selectedLocation.id,
      rating: reviewRating,
      comment: reviewComment,
      visitedWith: "Con i miei bambini",
    });
  };

  if (isLoading) {
    return <PageSkeleton variant="map" />;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Moms with coordinates (professionals see no mom markers), then the age filter
  const allMoms = isProfessional ? [] : profiles.filter((p) => p.latitude && p.longitude);
  const profilesWithCoords = allMoms.filter((p) => matchesAgeBand(p.kidsAges, ageBand));

  // Marker state combining server-side status with this session's optimistic
  // state: 'none' | 'pending' | 'connected' | 'cooldown'
  const markerStateOf = (profile: PublicProfile): "none" | "pending" | "connected" | "cooldown" => {
    const status = connectionStatus[profile.userId];
    if (status === "connected" || requestStates[profile.id] === "connected") return "connected";
    if (status === "pending_sent" || status === "pending_received" || requestStates[profile.id] === "requested") return "pending";
    if (status === "cooldown") return "cooldown";
    return "none";
  };

  const formatEventDate = (iso: string) =>
    new Date(iso).toLocaleString(user?.language === "en" ? "en-GB" : "it-IT", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });

  const zoneIsThin = !!community && !community.isOpenZone;

  return (
    <>
      {/* Map Content */}
      <main className="relative h-[100dvh] overflow-hidden bg-white">
        {/* Header - Floating on top of map */}
        <AppHeader left="settings" floating />

        {/* Density + kids' age filter: honest numbers, never a padded map */}
        {!isProfessional && (
          <div className="absolute left-4 right-4 z-40 top-[calc(5.75rem_+_env(safe-area-inset-top))] space-y-2 pointer-events-none">
            {community && (
              <div
                className="inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-gray-700 shadow pointer-events-auto"
                data-testid="density-chip"
              >
                <Users className="h-3.5 w-3.5 text-pink-500" />
                {fill(t("activeMomsInProvince"), { count: community.activeMoms14d, province: community.province })}
              </div>
            )}
            <div className="flex gap-1.5 overflow-x-auto pb-1 pointer-events-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {AGE_BANDS.map((b) => {
                const active = ageBand === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setAgeBand(b.key)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium shadow transition-colors ${
                      active ? "text-white" : "bg-white/90 text-gray-700 backdrop-blur"
                    }`}
                    style={active ? { background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" } : undefined}
                    aria-pressed={active}
                    data-testid={`filter-age-${b.key}`}
                  >
                    {b.key === "all" ? t(b.label) : `${t("filterKidsAge")} ${t(b.label)}`}
                  </button>
                );
              })}
              {ageBand !== "all" && (
                <span className="shrink-0 self-center text-xs text-gray-600 bg-white/80 rounded-full px-2 py-1">
                  {fill(t("momsMatchingFilter"), { count: profilesWithCoords.length })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Empty states live on top of the map: places and events stay visible */}
        {!isProfessional && profilesWithCoords.length === 0 && (
          <div className="absolute left-6 right-6 z-30 top-[calc(11rem_+_env(safe-area-inset-top))] pointer-events-none">
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-4 text-center pointer-events-auto">
              <div className="text-3xl mb-1">📍</div>
              {allMoms.length === 0 ? (
                <>
                  <h2 className="font-bold text-gray-800">
                    {myProvince ? fill(t("zoneGrowingTitle"), { province: myProvince }) : t("noMomsYetTitle")}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">{t("zoneGrowingHint")}</p>
                </>
              ) : (
                <>
                  <h2 className="font-bold text-gray-800">{t("noMomsWithFilter")}</h2>
                  <Button variant="link" className="text-pink-600" onClick={() => setAgeBand("all")} data-testid="button-show-all-moms">
                    {t("showAllMoms")}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        {!isProfessional && profilesWithCoords.length > 0 && zoneIsThin && community && (
          <div className="absolute left-6 right-6 z-30 bottom-[calc(6rem_+_env(safe-area-inset-bottom))] pointer-events-none">
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow p-3 text-xs text-gray-600 text-center pointer-events-auto">
              <span className="font-semibold text-gray-800">{fill(t("zoneGrowingTitle"), { province: community.province })}</span>{" "}
              {t("zoneGrowingHint")}
            </div>
          </div>
        )}

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
            options={{ clickableIcons: false }}
            onCameraChanged={(ev) => {
              if (ev.detail.center && ev.detail.zoom) {
                setMapCenter(ev.detail.center);
                setMapZoom(ev.detail.zoom);
              }
            }}
            onClick={() => {
              setSelectedProfile(null);
              setSelectedLocation(null);
              setSelectedEvent(null);
            }}
          >
            {profilesWithCoords.map((profile) => {
              // Marker semantics: white = not connected, pink = request
              // pending, profile photo = connection accepted, grey = she
              // declined recently.
              const markerState = markerStateOf(profile);
              const markerBgColor =
                markerState === "pending" ? "bg-pink-400" : markerState === "cooldown" ? "bg-gray-100" : "bg-white";
              const borderColor =
                markerState === "connected" || markerState === "pending"
                  ? "border-pink-500"
                  : markerState === "cooldown"
                    ? "border-gray-300"
                    : "border-pink-200";

              return (
                <AdvancedMarker
                  key={profile.id}
                  position={{ lat: parseFloat(profile.latitude!), lng: parseFloat(profile.longitude!) }}
                  onClick={() => { setSelectedEvent(null); setSelectedLocation(null); setSelectedProfile(profile); }}
                  zIndex={100}
                >
                  <div className="relative">
                    <div
                      className={`w-12 h-12 ${markerBgColor} rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-all duration-300 border-2 ${borderColor} overflow-hidden`}
                    >
                      {markerState === "connected" && profile.photoUrls?.[0] ? (
                        <img src={profile.photoUrls[0]} alt={profile.firstName} className="w-full h-full object-cover" />
                      ) : (
                        <img
                          src={heyMamaLogo}
                          alt="HeyMama"
                          className="w-8 h-8 object-contain transition-all duration-300"
                          style={{
                            filter: markerState === "pending" ? "brightness(0) invert(1)" : markerState === "cooldown" ? "grayscale(1) opacity(0.6)" : "none",
                          }}
                        />
                      )}
                    </div>
                    {(profile.isOnline || profile.activityBand === "today") && (
                      <div
                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${profile.isOnline ? "bg-green-500" : "bg-green-300"}`}
                      />
                    )}
                  </div>
                </AdvancedMarker>
              );
            })}

            {selectedProfile && (
              <InfoWindow
                position={{ lat: parseFloat(selectedProfile.latitude!), lng: parseFloat(selectedProfile.longitude!) }}
                onCloseClick={() => setSelectedProfile(null)}
                maxWidth={350}
              >
                <div className="p-2 relative">
                  <button
                    onClick={() => setSelectedProfile(null)}
                    className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors z-10"
                    data-testid="button-close-profile-popup"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>

                  {/* Photos: every picture, not just the first */}
                  <div className="mb-3">
                    <PhotoCarousel photos={selectedProfile.photoUrls} alt={selectedProfile.firstName} className="h-48" />
                  </div>

                  <div className="mb-2">
                    <h3 className="text-xl font-bold text-gray-800">
                      {selectedProfile.firstName}{selectedProfile.age != null ? `, ${selectedProfile.age}` : ""}
                    </h3>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-1 text-sm text-gray-600 min-w-0">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="truncate">{selectedProfile.location}</span>
                      </div>
                      <ActivityBadge isOnline={selectedProfile.isOnline} activityBand={selectedProfile.activityBand} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3 text-sm text-gray-700">
                    <Baby className="w-4 h-4 text-pink-500" />
                    <span>
                      {selectedProfile.kidsNumber} {selectedProfile.kidsNumber === 1 ? t("child") : t("children")}
                    </span>
                    {selectedProfile.kidsAges.length > 0 && (
                      <span className="text-gray-500">• {selectedProfile.kidsAges.join(", ")}</span>
                    )}
                  </div>

                  <p className="text-sm text-gray-700 mb-3 line-clamp-3">{selectedProfile.bio}</p>

                  {selectedProfile.hobbies && selectedProfile.hobbies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {selectedProfile.hobbies.slice(0, 5).map((hobby, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-pink-50 text-pink-700 border border-pink-200">
                          {hobby}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Connect: a request, messaging opens once she accepts */}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const state = markerStateOf(selectedProfile);
                      const incoming = connectionStatus[selectedProfile.userId] === "pending_received";
                      const label =
                        state === "connected"
                          ? t("connected")
                          : incoming
                            ? t("accept")
                            : state === "pending"
                              ? t("requestPending")
                              : state === "cooldown"
                                ? t("requestNotAvailable")
                                : t("connect");
                      const disabled =
                        requestMutation.isPending ||
                        state === "connected" ||
                        state === "cooldown" ||
                        (state === "pending" && !incoming);
                      return (
                        <Button
                          onClick={() => {
                            if (incoming) {
                              requestMutation.mutate({ targetUserId: selectedProfile.userId, profileId: selectedProfile.id });
                            } else {
                              setConnectMessage("");
                              setConnectTarget(selectedProfile);
                            }
                          }}
                          disabled={disabled}
                          size="lg"
                          className="flex-1 rounded-full text-white"
                          style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
                          data-testid="button-connect"
                        >
                          <UserPlus className="w-5 h-5 mr-2" />
                          {label}
                        </Button>
                      );
                    })()}
                    <ReportBlockControls
                      targetUserId={selectedProfile.userId}
                      targetType="profile"
                      targetId={selectedProfile.id}
                      variant="icons"
                      onBlocked={() => setSelectedProfile(null)}
                    />
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Upcoming events with a pin */}
            {mapEvents.map((event) => (
              <AdvancedMarker
                key={event.id}
                position={{ lat: parseFloat(event.latitude!), lng: parseFloat(event.longitude!) }}
                onClick={() => { setSelectedProfile(null); setSelectedLocation(null); setSelectedEvent(event); }}
                zIndex={60}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 border-white"
                  style={{ background: "linear-gradient(135deg, var(--primary-pink), var(--accent-coral))" }}>
                  <CalendarDays className="w-4 h-4 text-white" />
                </div>
              </AdvancedMarker>
            ))}

            {selectedEvent && (
              <InfoWindow
                position={{ lat: parseFloat(selectedEvent.latitude!), lng: parseFloat(selectedEvent.longitude!) }}
                onCloseClick={() => setSelectedEvent(null)}
                maxWidth={320}
              >
                <div className="p-2 relative">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors z-10"
                    data-testid="button-close-event-popup"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                  <Badge className="bg-pink-50 text-pink-700 border-0 mb-2">
                    <CalendarDays className="w-3 h-3 mr-1" />{t("eventMarker")}
                  </Badge>
                  <h3 className="text-lg font-bold text-gray-800 pr-6">{selectedEvent.title}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <Clock className="w-4 h-4 shrink-0" />{formatEventDate(selectedEvent.eventDate)}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-0.5">
                    <MapPin className="w-4 h-4 shrink-0" /><span className="truncate">{selectedEvent.location}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedEvent.rsvp.going > 0
                      ? fill(t("rsvpGoingCount"), { count: selectedEvent.rsvp.going })
                      : t("rsvpNobodyYet")}
                    {selectedEvent.creatorName ? ` • ${t("organizedBy")} ${selectedEvent.creatorName}` : ""}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setLocation("/events")} data-testid="button-open-events">
                      {t("openEvents")}
                    </Button>
                    {selectedEvent.rsvp.mine === "going" ? (
                      <Badge className="flex-1 justify-center bg-green-50 text-green-700 border-0">{t("rsvpYouGoing")}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 text-white"
                        style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
                        disabled={rsvpMutation.isPending}
                        onClick={() => rsvpMutation.mutate({ eventId: selectedEvent.id, status: "going" })}
                        data-testid="button-rsvp-going-map"
                      >
                        {t("rsvpGoing")}
                      </Button>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Database Location Markers */}
            {locations.map((location) => {
              const coords = location.coordinates.split(",");
              const lat = parseFloat(coords[0]);
              const lng = parseFloat(coords[1]);
              const { Icon, bgColor, borderColor } = getCategoryStyle(location.category);
              return (
                <AdvancedMarker
                  key={location.id}
                  position={{ lat, lng }}
                  onClick={() => { setSelectedProfile(null); setSelectedEvent(null); setSelectedLocation(location); }}
                  zIndex={1}
                >
                  <div className={`w-7 h-7 ${bgColor} rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 ${borderColor}`}>
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
                  <InfoWindow position={{ lat, lng }} onCloseClick={() => setSelectedLocation(null)} maxWidth={350}>
                    <div className="p-2 relative">
                      <button
                        onClick={() => setSelectedLocation(null)}
                        className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 transition-colors z-10"
                        data-testid="button-close-location-popup"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{selectedLocation.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                        <MapPin className="w-4 h-4" />{selectedLocation.address}
                      </div>
                      {selectedLocation.rating > 0 && (
                        <div className="flex items-center gap-1 mb-3">
                          <span className="text-yellow-500">★</span>
                          <span className="text-sm font-semibold">{selectedLocation.rating}/5</span>
                        </div>
                      )}
                      <div className="space-y-2 mt-4">
                        <h4 className="font-semibold text-sm">{t("heyMamaReviews")}</h4>
                        {locationReviews.length > 0 ? (
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {locationReviews.slice(0, 3).map((review: any) => (
                              <div key={review.id} className="text-xs border-b pb-2 last:border-0">
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="text-yellow-500">★</span>
                                  <span className="font-semibold">{review.rating}/5</span>
                                  <span className="text-gray-500">• {review.profile?.name}</span>
                                </div>
                                <p className="text-gray-700 line-clamp-2">{review.comment}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">{t("noReviewsYet")}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              const mapsUrl = selectedLocation.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                              window.open(mapsUrl, "_blank");
                            }}
                            data-testid="button-open-maps"
                          >
                            {t("openInMaps")}
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
                            onClick={() => setShowReviewModal(true)}
                            data-testid="button-add-review"
                          >
                            {t("writeReview")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </InfoWindow>
                );
              })()}
          </Map>
        </APIProvider>
      </main>

      {/* Connection request with an optional note */}
      <Dialog open={!!connectTarget} onOpenChange={(open) => { if (!open) setConnectTarget(null); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{connectTarget ? `${t("connect")} · ${connectTarget.firstName}` : t("connect")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">{t("requestMessageLabel")}</label>
            <Textarea
              value={connectMessage}
              onChange={(e) => setConnectMessage(e.target.value.slice(0, 300))}
              placeholder={t("requestMessagePlaceholder")}
              rows={3}
              data-testid="input-request-message"
            />
            <p className="text-xs text-gray-400 text-right">{connectMessage.length}/300</p>
            <Button
              className="w-full rounded-full text-white"
              style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
              disabled={requestMutation.isPending || !connectTarget}
              onClick={() =>
                connectTarget &&
                requestMutation.mutate({ targetUserId: connectTarget.userId, profileId: connectTarget.id, message: connectMessage })
              }
              data-testid="button-send-request"
            >
              {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><UserPlus className="w-5 h-5 mr-2" />{t("sendRequest")}</>)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("leaveReview")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t("ratingLabel")}</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setReviewRating(star)} className="focus:outline-none" data-testid={`star-${star}`}>
                    <Star className={`w-8 h-8 ${star <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("yourReview")}</label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={t("parkReviewPlaceholder")}
                rows={4}
                data-testid="input-review-comment"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowReviewModal(false); setReviewRating(0); setReviewComment(""); }}
                data-testid="button-cancel-review"
              >
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending}
                data-testid="button-submit-review"
              >
                {reviewMutation.isPending ? t("submitting") : t("submitReview")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
