import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, MapPin, Search, Star, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Location } from "@shared/schema";

interface GoogleMapsSearchProps {
  onClose: () => void;
  onLocationSelect: (location: Location) => void;
}

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
  };
  photos?: Array<{
    photo_reference: string;
  }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
}

export default function GoogleMapsSearch({ onClose, onLocationSelect }: GoogleMapsSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [province, setProvince] = useState("");
  const [places, setPlaces] = useState<GooglePlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  const { toast } = useToast();

  // Initialize Google Maps
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      const mapElement = document.getElementById('google-map');
      if (mapElement && window.google) {
        const mapInstance = new google.maps.Map(mapElement, {
          center: { lat: 41.9028, lng: 12.4964 }, // Rome, Italy
          zoom: 6,
        });
        setMap(mapInstance);
        setPlacesService(new google.maps.places.PlacesService(mapInstance));
      }
    };

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const searchPlaces = async () => {
    if (!placesService || !searchQuery.trim()) return;

    setIsSearching(true);
    
    const request: google.maps.places.TextSearchRequest = {
      query: `${searchQuery} playground park ${province}`.trim(),
      type: 'park',
      region: 'IT', // Italy
    };

    placesService.textSearch(request, (results, status) => {
      setIsSearching(false);
      
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        // Filter for parks and playgrounds
        const filteredPlaces = results.filter(place => 
          place.types?.some(type => 
            ['park', 'amusement_park', 'playground', 'tourist_attraction'].includes(type)
          )
        );
        setPlaces(filteredPlaces as GooglePlace[]);
        
        if (filteredPlaces.length === 0) {
          toast({
            title: "No parks found",
            description: "Try searching with a different location or keywords.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Search failed",
          description: "Unable to search for parks. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const saveLocationMutation = useMutation({
    mutationFn: async (place: GooglePlace) => {
      const locationData = {
        name: place.name,
        category: "Park",
        address: place.formatted_address,
        province: extractProvince(place.formatted_address),
        description: `Family-friendly park found on Google Maps. ${place.rating ? `Rated ${place.rating}/5 stars.` : ''}`,
        imageUrl: place.photos?.[0] 
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${import.meta.env.GOOGLE_MAPS_API_KEY}`
          : "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400",
        rating: Math.round(place.rating || 4),
        amenities: determineAmenities(place.types),
        ageGroups: ["0-2", "3-5", "6-12"],
        coordinates: `${place.geometry.location.lat},${place.geometry.location.lng}`,
        openingHours: place.opening_hours?.weekday_text?.join(", ") || "Hours vary",
        googlePlaceId: place.place_id,
        isGooglePlace: true,
      };

      const response = await apiRequest("POST", "/api/locations", locationData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Park Added!",
        description: "The park has been added to your places.",
      });
      onLocationSelect(data);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add park. Please try again.",
        variant: "destructive",
      });
    },
  });

  const extractProvince = (address: string): string => {
    // Extract province from Italian address format
    const parts = address.split(",");
    if (parts.length >= 2) {
      const provincePart = parts[parts.length - 2].trim();
      return provincePart.split(" ")[0]; // Get first word (usually the province)
    }
    return "Unknown";
  };

  const determineAmenities = (types: string[]): string[] => {
    const amenities = ["Green spaces"];
    
    if (types.includes("amusement_park")) amenities.push("Playground equipment");
    if (types.includes("tourist_attraction")) amenities.push("Scenic views");
    amenities.push("Walking paths", "Family-friendly");
    
    return amenities;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchPlaces();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl max-h-[90vh] w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Find Parks with Google Maps</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search Form */}
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search for parks, playgrounds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Province (e.g., Milano, Roma, Torino)"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
          </div>
          
          <Button
            onClick={searchPlaces}
            disabled={isSearching || !searchQuery.trim()}
            className="w-full text-white"
            style={{ 
              background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
            }}
          >
            {isSearching ? "Searching..." : "Search Parks"}
          </Button>
        </div>

        {/* Hidden Map Container */}
        <div id="google-map" style={{ display: 'none', width: '100px', height: '100px' }}></div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
          {places.length === 0 && !isSearching && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🗺️</div>
              <p>Search for parks and playgrounds above</p>
            </div>
          )}

          {places.map((place) => (
            <div
              key={place.place_id}
              className="bg-gray-50 rounded-xl p-4 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => saveLocationMutation.mutate(place)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">{place.name}</h3>
                  {place.rating && (
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-gray-600">{place.rating}/5</span>
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  Park
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <MapPin className="h-3 w-3" />
                <span className="line-clamp-1">{place.formatted_address}</span>
              </div>
              
              {place.opening_hours && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-3 w-3" />
                  <span className={place.opening_hours.open_now ? "text-green-600" : "text-red-600"}>
                    {place.opening_hours.open_now ? "Open now" : "Closed"}
                  </span>
                </div>
              )}
              
              <Button
                size="sm"
                className="w-full mt-3 text-white"
                style={{ 
                  background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                }}
                disabled={saveLocationMutation.isPending}
              >
                {saveLocationMutation.isPending ? "Adding..." : "Add to Places"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}