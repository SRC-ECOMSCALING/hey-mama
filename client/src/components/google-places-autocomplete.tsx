import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search } from "lucide-react";
import { loadGoogleMapsAPI } from "@/utils/google-maps-loader";
import { useLanguage } from "@/contexts/LanguageContext";

interface PlaceResult {
  place_id: string;
  description: string;
  lat: number;
  lng: number;
  name?: string;
  province?: string;
}

interface GooglePlacesAutocompleteProps {
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
}

export default function GooglePlacesAutocomplete({ 
  onPlaceSelect, 
  placeholder,
  className = ""
}: GooglePlacesAutocompleteProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState("");
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // Load Google Maps API and initialize services
    loadGoogleMapsAPI()
      .then(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          autocompleteService.current = new window.google.maps.places.AutocompleteService();
          
          // Create a temporary map for PlacesService (required by Google Maps API)
          mapRef.current = new window.google.maps.Map(document.createElement('div'));
          placesService.current = new window.google.maps.places.PlacesService(mapRef.current);
          console.log('Google Places autocomplete services initialized');
        } else {
          console.error('Google Maps Places library not loaded');
        }
      })
      .catch((error) => {
        console.error('Failed to load Google Maps API:', error);
      });
  }, []);

  const handleInputChange = (value: string) => {
    setInput(value);
    
    if (value.length > 2 && autocompleteService.current) {
      const request = {
        input: value
        // No type or country restrictions - allow all places globally
      };

      autocompleteService.current.getPlacePredictions(request, (predictions: any[], status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setPredictions(predictions);
          setIsOpen(true);
        } else {
          setPredictions([]);
          setIsOpen(false);
        }
      });
    } else {
      setPredictions([]);
      setIsOpen(false);
    }
  };

  const handlePlaceSelect = (prediction: any) => {
    setIsLoading(true);
    setInput(prediction.description);
    setIsOpen(false);

    if (placesService.current) {
      const request = {
        placeId: prediction.place_id,
        fields: ['geometry', 'formatted_address', 'name', 'address_components']
      };

      placesService.current.getDetails(request, (place: any, status: any) => {
        setIsLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place.geometry) {
          // Extract province from address components
          let province = '';
          if (place.address_components) {
            const stateComponent = place.address_components.find((component: any) => 
              component.types.includes('administrative_area_level_1')
            );
            province = stateComponent ? stateComponent.long_name : '';
          }
          
          const result: PlaceResult = {
            place_id: prediction.place_id,
            description: place.formatted_address || prediction.description,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            name: place.name,
            province: province
          };
          onPlaceSelect(result);
        }
      });
    }
  };

  const handleSearch = () => {
    if (predictions.length > 0) {
      handlePlaceSelect(predictions[0]);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <Input
            type="text"
            placeholder={placeholder || t("searchPlaceholder")}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => predictions.length > 0 && setIsOpen(true)}
            className={`pl-11 ${isLoading ? "pr-10" : ""}`}
            data-testid="input-address-search"
          />
          {isLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
            </div>
          )}
        </div>
        <Button
          type="button"
          onClick={handleSearch}
          disabled={predictions.length === 0 || isLoading}
          className="h-12 shrink-0"
          data-testid="button-search-address"
        >{t("search")}</Button>
      </div>
      {/* Autocomplete Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_16px_40px_rgba(23,17,31,0.16)]">
          {predictions.map((prediction, index) => (
            <button
              type="button"
              key={prediction.place_id}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
              onClick={() => handlePlaceSelect(prediction)}
              data-testid={`option-address-${index}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50" aria-hidden="true">
                <MapPin className="h-4 w-4 text-purple-700" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900">
                  {prediction.structured_formatting?.main_text || prediction.description}
                </span>
                {prediction.structured_formatting?.secondary_text && (
                  <span className="block truncate text-[13px] text-gray-600">
                    {prediction.structured_formatting.secondary_text}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}