import { useState, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fill } from "@/lib/format";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import {
  MapPin,
  Baby,
  Trees,
  BookOpen,
  Palette,
  Waves,
  Utensils,
  Coffee,
  ShoppingBag,
  Theater,
  Blocks,
  CalendarDays,
  Clock,
  Check,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  Navigation as NavigationIcon,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PublicProfile, Location } from "@shared/schema";
import { PROVINCE_COORDINATES } from "@shared/provinces";
import type { TranslationKey } from "@/lib/translations";
import heyMamaSymbol from "@assets/heymama-symbol.png";
import barImage from "@assets/bar_1757514529485.jpg";
import libraryImage from "@assets/library_1757514529486.jpg";
import parkImage from "@assets/park_1757514529486.jpg";
import playgroundImage from "@assets/playground_1757514529486.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import PageSkeleton from "@/components/page-skeleton";
import NotificationIcon from "@/components/notification-icon";
import ActivityBadge from "@/components/activity-badge";
import LocationModal from "@/components/location-modal";
import PhotoOrInitial from "@/components/photo-or-initial";
import MomSheet, { commonGround, kidAgeLabel, type MomConnectionState } from "@/components/explore/mom-sheet";
import AddLocationDialog from "@/components/explore/add-location-dialog";
import ProfessionalsList from "@/components/explore/professionals-list";

// --- Places: one normalised "kind" per category ---------------------------
// Categories are stored in different shapes ("parco" from the admin CSV,
// "Parco" from the OSM import, "Parco Giochi" from user submissions).
type PlaceKind = "park" | "playground" | "library" | "cafe" | "water" | "activity" | "restaurant" | "museum" | "mall" | "theatre" | "other";

const PLACE_ALIASES: Record<string, PlaceKind> = {
  parco: "park",
  park: "park",
  "parco giochi": "playground",
  playground: "playground",
  biblioteca: "library",
  library: "library",
  museo: "museum",
  "caffè": "cafe",
  caffe: "cafe",
  cafe: "cafe",
  "café": "cafe",
  bar: "cafe",
  piscina: "water",
  "parco acquatico": "water",
  "water park": "water",
  ristorante: "restaurant",
  ristoranti: "restaurant",
  restaurants: "restaurant",
  "centro-commerciale": "mall",
  "centro attività": "activity",
  "activity center": "activity",
  teatro: "theatre",
};

const PLACE_ICONS: Record<PlaceKind, LucideIcon> = {
  park: Trees,
  playground: Baby,
  library: BookOpen,
  cafe: Coffee,
  water: Waves,
  activity: Blocks,
  restaurant: Utensils,
  museum: Palette,
  mall: ShoppingBag,
  theatre: Theater,
  other: MapPin,
};

const placeKindOf = (category: string): PlaceKind => PLACE_ALIASES[category.trim().toLowerCase()] ?? "other";

const placeImageOf = (kind: PlaceKind): string =>
  kind === "cafe" || kind === "restaurant" ? barImage : kind === "library" || kind === "museum" ? libraryImage : kind === "playground" || kind === "activity" ? playgroundImage : parkImage;

const PLACE_FILTERS: { key: "all" | PlaceKind; label: TranslationKey }[] = [
  { key: "all", label: "categoryAll" },
  { key: "park", label: "categoryPark" },
  { key: "playground", label: "categoryPlayground" },
  { key: "cafe", label: "categoryCafe" },
  { key: "library", label: "categoryLibrary" },
  { key: "water", label: "categoryWaterPark" },
  { key: "activity", label: "categoryActivityCenter" },
  { key: "restaurant", label: "categoryRestaurants" },
];

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

// The map shows one family of things at a time
type Layer = "moms" | "places" | "events" | "pros";

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

const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

// Hands the Google map instance to the page, so lists and buttons can pan it.
function MapBridge({ mapRef }: { mapRef: MutableRefObject<any> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

const initialLayer = (isProfessional: boolean): Layer => {
  const asked = new URLSearchParams(window.location.search).get("layer");
  const allowed: Layer[] = isProfessional ? ["places", "pros"] : ["moms", "places", "events", "pros"];
  return allowed.includes(asked as Layer) ? (asked as Layer) : allowed[0];
};

export default function Discover() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Professional accounts don't connect with moms: they see places only.
  const isProfessional = user?.accountType === "professional";
  const myProvince = user?.province ?? null;

  const [layer, setLayer] = useState<Layer>(() => initialLayer(isProfessional));
  const [sheetOpen, setSheetOpen] = useState(true);
  const [placeFilter, setPlaceFilter] = useState<"all" | PlaceKind>("all");
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithReviews | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
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
  const mapRef = useRef<any>(null);

  const { data: profiles = [], isLoading } = useQuery<PublicProfile[]>({
    queryKey: ["/api/profiles/map"],
  });

  // The viewer's own profile, to show what she has in common with each mom
  const { data: myProfile } = useQuery<PublicProfile>({
    queryKey: ["/api/profiles", CURRENT_USER_ID],
    enabled: !isProfessional,
  });

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

  const { data: locations = [] } = useQuery<LocationWithReviews[]>({
    queryKey: ["/api/locations"],
  });

  const { data: events = [] } = useQuery<MapEvent[]>({
    queryKey: ["/api/events"],
    enabled: !isProfessional,
  });
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => e.status === "approved" && new Date(e.eventDate).getTime() >= now - 3 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [events]);
  const mapEvents = useMemo(() => upcomingEvents.filter((e) => e.latitude && e.longitude), [upcomingEvents]);

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
      setSelectedProfile(null);
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

  // Marker state combining server-side status with this session's optimistic state
  const markerStateOf = (profile: PublicProfile): MomConnectionState => {
    const status = connectionStatus[profile.userId];
    if (status === "connected" || requestStates[profile.id] === "connected") return "connected";
    if (status === "pending_sent" || status === "pending_received" || requestStates[profile.id] === "requested") return "pending";
    if (status === "cooldown") return "cooldown";
    return "none";
  };

  // Moms with coordinates (professionals see no mom markers), then the age
  // filter; whoever is around right now comes first in the list.
  const allMoms = useMemo(() => (isProfessional ? [] : profiles.filter((p) => p.latitude && p.longitude)), [profiles, isProfessional]);
  const moms = useMemo(() => {
    const rank = (p: PublicProfile) => (p.isOnline ? 0 : p.activityBand === "today" ? 1 : p.activityBand === "week" ? 2 : 3);
    return allMoms
      .filter((p) => matchesAgeBand(p.kidsAges, ageBand))
      .map((p) => ({ profile: p, common: commonGround(t, myProfile, p) }))
      .sort((a, b) => rank(a.profile) - rank(b.profile) || b.common.length - a.common.length);
  }, [allMoms, ageBand, myProfile, t]);

  // Places nearest to where the map is looking (rounded, so the list doesn't
  // reshuffle on every pixel of a pan)
  const listAnchor = useMemo(
    () => ({ lat: Math.round(mapCenter.lat * 50) / 50, lng: Math.round(mapCenter.lng * 50) / 50 }),
    [mapCenter.lat, mapCenter.lng],
  );
  const places = useMemo(() => {
    return locations
      .map((location) => {
        const [lat, lng] = location.coordinates.split(",").map((v) => parseFloat(v));
        const kind = placeKindOf(location.category);
        return { location, lat, lng, kind, distance: Number.isNaN(lat) || Number.isNaN(lng) ? Infinity : kmBetween(listAnchor, { lat, lng }) };
      })
      .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
  }, [locations, listAnchor]);
  const listedPlaces = useMemo(
    () =>
      places
        .filter((p) => placeFilter === "all" || p.kind === placeFilter)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 30),
    [places, placeFilter],
  );

  if (isLoading) {
    return <PageSkeleton variant="map" />;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const locale = user?.language === "en" ? "en-GB" : "it-IT";
  const zoneIsThin = !!community && !community.isOpenZone;

  const panTo = (lat: number, lng: number, minZoom = 13) => {
    const map = mapRef.current;
    if (!map) return;
    map.panTo({ lat, lng });
    if ((map.getZoom?.() ?? 0) < minZoom) map.setZoom(minZoom);
  };

  const recenter = () => {
    const home = myProvince ? PROVINCE_COORDINATES[myProvince] : undefined;
    if (home) return panTo(home.lat, home.lng, 12);
    const first = allMoms[0];
    if (first) panTo(parseFloat(first.latitude!), parseFloat(first.longitude!), 12);
  };

  const clearSelection = () => {
    setSelectedProfile(null);
    setSelectedLocation(null);
    setSelectedEvent(null);
  };

  const openMom = (profile: PublicProfile) => {
    setSelectedLocation(null);
    setSelectedEvent(null);
    setSelectedProfile(profile);
    panTo(parseFloat(profile.latitude!), parseFloat(profile.longitude!));
  };

  const openEvent = (event: MapEvent) => {
    setSelectedProfile(null);
    setSelectedLocation(null);
    setSelectedEvent(event);
    if (event.latitude && event.longitude) panTo(parseFloat(event.latitude), parseFloat(event.longitude));
  };

  const eventDay = (iso: string) => {
    const d = new Date(iso);
    return {
      weekday: d.toLocaleDateString(locale, { weekday: "short" }).replace(".", "").toUpperCase(),
      day: d.getDate(),
      time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
      full: d.toLocaleString(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    };
  };

  const layers: { key: Layer; label: string }[] = isProfessional
    ? [
        { key: "places", label: t("places") },
        { key: "pros", label: t("professionals") },
      ]
    : [
        { key: "moms", label: t("exploreLayerMoms") },
        { key: "places", label: t("places") },
        { key: "events", label: t("events") },
        { key: "pros", label: t("professionals") },
      ];

  const showMoms = layer === "moms";
  const showPlaces = layer === "places";
  const showEvents = layer === "moms" || layer === "events";
  const momCountLabel = moms.length === 1 ? t("exploreMomsCountOne") : fill(t("exploreMomsCount"), { count: moms.length });
  const activeAgeLabel = AGE_BANDS.find((b) => b.key === ageBand)!.label;

  return (
    <>
      <main className="relative h-[100dvh] overflow-hidden bg-gray-100">
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
            zoomControl={false}
            cameraControl={false}
            keyboardShortcuts={false}
            fullscreenControl={false}
            mapId="cb6dc0b32328db269be352c6"
            options={{ clickableIcons: false }}
            onCameraChanged={(ev) => {
              if (ev.detail.center && ev.detail.zoom) {
                setMapCenter(ev.detail.center);
                setMapZoom(ev.detail.zoom);
              }
            }}
            onClick={clearSelection}
          >
            <MapBridge mapRef={mapRef} />

            {/* Moms: photo (or initial) in a white ring; magenta ring when she
                is around today; a small badge for pending / connected */}
            {showMoms &&
              moms.map(({ profile }) => {
                const state = markerStateOf(profile);
                const fresh = profile.isOnline || profile.activityBand === "today";
                const selected = selectedProfile?.id === profile.id;
                return (
                  <AdvancedMarker
                    key={profile.id}
                    position={{ lat: parseFloat(profile.latitude!), lng: parseFloat(profile.longitude!) }}
                    onClick={() => openMom(profile)}
                    zIndex={selected ? 200 : 100}
                  >
                    <div className="flex flex-col items-center gap-1.5" data-testid={`marker-mom-${profile.id}`}>
                      <div className="relative">
                        <div
                          className={`flex items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-pink-100 font-display font-semibold text-gray-900 transition-all duration-200 ${
                            selected ? "h-[68px] w-[68px] text-2xl" : "h-12 w-12 text-base"
                          } ${state === "cooldown" ? "opacity-60 grayscale" : ""}`}
                          style={{
                            boxShadow: fresh
                              ? `0 0 0 3px var(--magenta)${selected ? ", 0 0 0 12px rgba(216,27,114,0.16)" : ""}, 0 8px 20px rgba(23,17,31,0.22)`
                              : "0 6px 16px rgba(23,17,31,0.2)",
                          }}
                        >
                          <PhotoOrInitial src={profile.photoUrls?.[0]} name={profile.firstName} />
                        </div>
                        {state === "connected" && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-pink-500 ring-2 ring-white">
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          </span>
                        )}
                        {state === "pending" && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white ring-2 ring-white">
                            <Clock className="h-3 w-3 text-pink-700" strokeWidth={2.6} />
                          </span>
                        )}
                      </div>
                      {selected && <span className="glass rounded-full px-2.5 py-1 text-xs font-semibold text-gray-900">{profile.firstName}</span>}
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* Upcoming events with a pin */}
            {showEvents &&
              mapEvents.map((event) => (
                <AdvancedMarker
                  key={event.id}
                  position={{ lat: parseFloat(event.latitude!), lng: parseFloat(event.longitude!) }}
                  onClick={() => openEvent(event)}
                  zIndex={60}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border-[3px] border-white bg-purple-600 shadow-[0_6px_16px_rgba(23,17,31,0.2)]">
                    <CalendarDays className="h-[18px] w-[18px] text-white" />
                  </div>
                </AdvancedMarker>
              ))}

            {/* Family-friendly places */}
            {showPlaces &&
              places
                .filter((p) => placeFilter === "all" || p.kind === placeFilter)
                .map(({ location, lat, lng, kind }) => {
                  const Icon = PLACE_ICONS[kind];
                  const selected = selectedLocation?.id === location.id;
                  return (
                    <AdvancedMarker
                      key={location.id}
                      position={{ lat, lng }}
                      onClick={() => {
                        setSelectedProfile(null);
                        setSelectedEvent(null);
                        setSelectedLocation(location);
                      }}
                      zIndex={selected ? 50 : 1}
                    >
                      <div
                        className={`flex items-center justify-center rounded-[18px] rounded-bl-md border-[3px] shadow-[0_6px_16px_rgba(23,17,31,0.18)] ${
                          selected ? "h-11 w-11 border-white bg-purple-600 text-white" : "h-9 w-9 border-purple-600 bg-white text-purple-700"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                    </AdvancedMarker>
                  );
                })}
          </Map>
        </APIProvider>

        {/* Top bar: where you are, notifications, and the map layers */}
        <div className="pointer-events-none absolute inset-x-4 top-[calc(0.875rem_+_env(safe-area-inset-top))] z-30 space-y-2.5">
          <div className="pointer-events-auto flex items-center gap-2.5">
            <div className="glass flex h-[54px] min-w-0 flex-1 items-center gap-3 rounded-[20px] px-4">
              <img src={heyMamaSymbol} alt="" className="h-7 w-7 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-semibold leading-tight text-gray-900">{myProvince || "HeyMama"}</p>
                {community && !isProfessional && (
                  <p className="truncate text-xs font-medium leading-tight text-gray-600" data-testid="density-chip">
                    {fill(t("exploreActiveShort"), { count: community.activeMoms14d })}
                  </p>
                )}
              </div>
            </div>
            <NotificationIcon variant="glass" />
          </div>

          <div role="group" aria-label={t("exploreLayers")} className="no-scrollbar pointer-events-auto -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {layers.map(({ key, label }) => {
              const active = layer === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    clearSelection();
                    setLayer(key);
                    setSheetOpen(true);
                  }}
                  className={`glass h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${active ? "text-pink-700" : "text-gray-900"}`}
                  style={
                    active
                      ? { background: "rgba(252,232,241,0.82)", boxShadow: "inset 0 0 0 2px var(--magenta), 0 4px 14px rgba(23,17,31,0.1)" }
                      : undefined
                  }
                  data-testid={`layer-${key}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={recenter}
              aria-label={t("exploreRecenter")}
              className="glass pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl text-gray-900"
              data-testid="button-recenter"
            >
              <NavigationIcon className="h-5 w-5" strokeWidth={1.9} />
            </button>
          </div>
        </div>

        {/* The list of what the map is showing, in a floating glass panel */}
        <section
          className="glass-panel absolute inset-x-2.5 bottom-[calc(5.75rem_+_env(safe-area-inset-bottom))] z-30 flex max-h-[52dvh] flex-col overflow-hidden rounded-[32px]"
          aria-label={layers.find((l) => l.key === layer)?.label}
        >
          <button
            type="button"
            onClick={() => setSheetOpen((open) => !open)}
            aria-label={t("exploreToggleList")}
            aria-expanded={sheetOpen}
            className="flex h-6 w-full shrink-0 items-center justify-center"
            data-testid="button-toggle-list"
          >
            <span className="h-[5px] w-10 rounded-full bg-gray-300" />
          </button>

          {/* Moms */}
          {layer === "moms" && (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2.5">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold leading-tight text-gray-900">{t("exploreNearYou")}</h1>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-gray-600">
                    {ageBand === "all" ? momCountLabel : `${t("filterKidsAge")} ${t(activeAgeLabel)} · ${momCountLabel}`}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-semibold ${
                        ageBand === "all" ? "text-gray-900 ring-1 ring-inset ring-gray-200" : "text-pink-700 ring-2 ring-inset ring-pink-500"
                      }`}
                      data-testid="button-age-filter"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {t("filterKidsAge")}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[11rem]">
                    <DropdownMenuRadioGroup value={ageBand} onValueChange={(v) => setAgeBand(v as AgeBand)}>
                      {AGE_BANDS.map((b) => (
                        <DropdownMenuRadioItem key={b.key} value={b.key} data-testid={`filter-age-${b.key}`}>
                          {t(b.label)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {sheetOpen &&
                (moms.length === 0 ? (
                  <div className="px-5 pb-5 pt-1 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-pink-50">
                      <Users className="h-6 w-6 text-pink-500" />
                    </div>
                    {allMoms.length === 0 ? (
                      <>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {myProvince ? fill(t("zoneGrowingTitle"), { province: myProvince }) : t("noMomsYetTitle")}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">{t("zoneGrowingHint")}</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold text-gray-900">{t("noMomsWithFilter")}</h2>
                        <Button variant="link" onClick={() => setAgeBand("all")} data-testid="button-show-all-moms">
                          {t("showAllMoms")}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 pb-4">
                      {moms.map(({ profile, common }) => {
                        const state = markerStateOf(profile);
                        const fresh = profile.isOnline || profile.activityBand === "today";
                        const selected = selectedProfile?.id === profile.id;
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => openMom(profile)}
                            className={`flex w-[158px] shrink-0 flex-col gap-2.5 rounded-[22px] bg-white/75 p-3 text-left ${
                              selected ? "ring-2 ring-inset ring-pink-500" : ""
                            }`}
                            data-testid={`card-mom-${profile.id}`}
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pink-100 font-display text-base font-semibold text-gray-900 ${
                                  fresh ? "ring-online" : ""
                                }`}
                              >
                                <PhotoOrInitial src={profile.photoUrls?.[0]} name={profile.firstName} />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-display text-[15px] font-semibold leading-tight text-gray-900">
                                  {profile.firstName}
                                  {profile.age != null ? `, ${profile.age}` : ""}
                                </span>
                                <ActivityBadge isOnline={profile.isOnline} activityBand={profile.activityBand} variant="text" className="mt-1 block" />
                              </span>
                            </span>
                            {profile.kidsAges.length > 0 && (
                              <span className="truncate text-xs font-medium text-gray-600">
                                {profile.kidsAges.map((age) => kidAgeLabel(t, age)).join(" · ")}
                              </span>
                            )}
                            {state === "connected" ? (
                              <span className="tag-neutral self-start">{t("connected")}</span>
                            ) : state === "pending" ? (
                              <span className="tag-neutral self-start">{t("requestPending")}</span>
                            ) : common.length > 0 ? (
                              <span className="tag-pink self-start">
                                {common.length === 1 ? t("commonCountOne") : fill(t("commonCount"), { count: common.length })}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {zoneIsThin && community && (
                      <p className="px-5 pb-4 text-xs leading-snug text-gray-600">
                        <span className="font-semibold text-gray-900">{fill(t("zoneGrowingTitle"), { province: community.province })}.</span>{" "}
                        {t("zoneGrowingHint")}
                      </p>
                    )}
                  </>
                ))}
            </>
          )}

          {/* Places */}
          {layer === "places" && (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2.5">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold leading-tight text-gray-900">{t("explorePlacesTitle")}</h1>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-gray-600">{t("explorePlacesSubtitle")}</p>
                </div>
                <AddLocationDialog
                  trigger={
                    <button
                      type="button"
                      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white pl-3 pr-3.5 text-[13px] font-semibold text-gray-900 ring-1 ring-inset ring-gray-200"
                      data-testid="button-add-location"
                    >
                      <Plus className="h-4 w-4" />
                      {t("exploreSuggestPlace")}
                    </button>
                  }
                />
              </div>
              {sheetOpen && (
                <>
                  <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 pb-3">
                    {PLACE_FILTERS.map(({ key, label }) => {
                      const on = placeFilter === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setPlaceFilter(key)}
                          className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] ${
                            on ? "bg-purple-50 font-semibold text-purple-700" : "bg-white/70 font-medium text-gray-900"
                          }`}
                          data-testid={`filter-${label.toLowerCase()}`}
                        >
                          {t(label)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
                    {listedPlaces.length === 0 ? (
                      <div className="py-6 text-center">
                        <h2 className="text-lg font-semibold text-gray-900">{t("noLocationsFound")}</h2>
                        <p className="mt-1 text-sm text-gray-600">{t("tryDifferentCategory")}</p>
                      </div>
                    ) : (
                      listedPlaces.map(({ location, lat, lng, kind, distance }) => (
                        <button
                          key={location.id}
                          type="button"
                          onClick={() => {
                            panTo(lat, lng, 14);
                            setSelectedLocation(location);
                          }}
                          className="flex w-full items-center gap-3.5 border-b border-gray-200/70 py-3 text-left last:border-0"
                          data-testid={`row-place-${location.id}`}
                        >
                          <img src={placeImageOf(kind)} alt="" loading="lazy" className="h-[68px] w-[68px] shrink-0 rounded-[20px] object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-base font-semibold leading-tight text-gray-900">{location.name}</span>
                            <span className="mt-1 block truncate text-[13px] text-gray-600">
                              {location.category}
                              {Number.isFinite(distance) ? ` · ${distance < 10 ? distance.toFixed(1).replace(".", ",") : Math.round(distance)} km` : ""}
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-gray-600">{location.address}</span>
                          </span>
                          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-500" />
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Events */}
          {layer === "events" && (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2.5">
                <h1 className="min-w-0 truncate text-xl font-semibold leading-tight text-gray-900">{t("exploreEventsTitle")}</h1>
                <button
                  type="button"
                  onClick={() => setLocation("/events")}
                  className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-white pl-3.5 pr-2.5 text-[13px] font-semibold text-gray-900 ring-1 ring-inset ring-gray-200"
                  data-testid="button-open-events"
                >
                  {t("openEvents")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {sheetOpen && (
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
                  {upcomingEvents.length === 0 ? (
                    <div className="py-6 text-center">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-50">
                        <CalendarDays className="h-6 w-6 text-purple-700" />
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900">{t("noEventsYet")}</h2>
                    </div>
                  ) : (
                    upcomingEvents.map((event) => {
                      const when = eventDay(event.eventDate);
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => openEvent(event)}
                          className="flex w-full items-center gap-3.5 border-b border-gray-200/70 py-3 text-left last:border-0"
                          data-testid={`row-event-${event.id}`}
                        >
                          <span className="flex h-[68px] w-[56px] shrink-0 flex-col items-center justify-center gap-1 rounded-[18px] bg-white/80">
                            <span className="text-[11px] font-semibold leading-none text-gray-600">{when.weekday}</span>
                            <span className="font-display text-2xl font-bold leading-none text-gray-900">{when.day}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-base font-semibold leading-tight text-gray-900">{event.title}</span>
                            <span className="mt-1 block truncate text-[13px] text-gray-600">
                              {when.time} · {event.location}
                            </span>
                            <span className="mt-0.5 block truncate text-xs font-medium text-gray-600">
                              {event.rsvp.mine === "going"
                                ? t("rsvpYouGoing")
                                : event.rsvp.going > 0
                                  ? fill(t("rsvpGoingCount"), { count: event.rsvp.going })
                                  : t("rsvpNobodyYet")}
                            </span>
                          </span>
                          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-500" />
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}

          {/* Professionals */}
          {layer === "pros" && (
            <>
              <div className="shrink-0 px-4 pb-2.5">
                <h1 className="text-xl font-semibold leading-tight text-gray-900">{t("exploreProsTitle")}</h1>
              </div>
              {sheetOpen && (
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                  <ProfessionalsList />
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* A mom's profile and the connection request */}
      <MomSheet
        profile={selectedProfile}
        me={myProfile}
        state={selectedProfile ? markerStateOf(selectedProfile) : "none"}
        incoming={!!selectedProfile && connectionStatus[selectedProfile.userId] === "pending_received"}
        isSending={requestMutation.isPending}
        onClose={() => setSelectedProfile(null)}
        onSend={(message) =>
          selectedProfile && requestMutation.mutate({ targetUserId: selectedProfile.userId, profileId: selectedProfile.id, message })
        }
      />

      {/* An event picked on the map or in the list */}
      <Drawer open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)} shouldScaleBackground={false}>
        <DrawerContent data-testid="event-sheet">
          {selectedEvent && (
            <div className="px-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] pt-5">
              <span className="tag-violet">
                <CalendarDays className="h-3.5 w-3.5" />
                {t("eventMarker")}
              </span>
              <DrawerTitle className="mt-3 text-2xl leading-tight">{selectedEvent.title}</DrawerTitle>
              <DrawerDescription asChild>
                <div className="mt-3 space-y-2 text-sm font-medium text-gray-700">
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-gray-500" />
                    <span className="first-letter:uppercase">{eventDay(selectedEvent.eventDate).full}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-gray-500" />
                    <span className="truncate">{selectedEvent.location}</span>
                  </p>
                  <p className="text-[13px] text-gray-600">
                    {selectedEvent.rsvp.going > 0 ? fill(t("rsvpGoingCount"), { count: selectedEvent.rsvp.going }) : t("rsvpNobodyYet")}
                    {selectedEvent.creatorName ? ` · ${t("organizedBy")} ${selectedEvent.creatorName}` : ""}
                  </p>
                </div>
              </DrawerDescription>
              <div className="mt-6 flex gap-2.5">
                <Button variant="outline" className="h-14 flex-1 rounded-[18px]" onClick={() => setLocation("/events")}>
                  {t("openEvents")}
                </Button>
                {selectedEvent.rsvp.mine === "going" ? (
                  <span className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[18px] bg-pink-50 text-base font-semibold text-pink-700">
                    <Check className="h-[18px] w-[18px]" strokeWidth={2.6} />
                    {t("rsvpYouGoing")}
                  </span>
                ) : (
                  <Button
                    size="lg"
                    className="flex-1 px-4"
                    disabled={rsvpMutation.isPending}
                    onClick={() => rsvpMutation.mutate({ eventId: selectedEvent.id, status: "going" })}
                    data-testid="button-rsvp-going-map"
                  >
                    {t("rsvpGoing")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* A place: details and reviews */}
      {selectedLocation && <LocationModal location={selectedLocation} onClose={() => setSelectedLocation(null)} />}
    </>
  );
}
