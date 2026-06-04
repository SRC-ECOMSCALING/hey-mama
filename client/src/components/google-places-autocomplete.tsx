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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={placeholder || t("searchPlaceholder")}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => predictions.length > 0 && setIsOpen(true)}
            className="pl-10 rounded-full border-gray-200 focus:border-primary-pink focus:ring-primary-pink"
            data-testid="input-address-search"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full" />
            </div>
          )}
        </div>
        <Button
          onClick={handleSearch}
          disabled={predictions.length === 0 || isLoading}
          className="rounded-full px-6"
          style={{
            background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
          }}
          data-testid="button-search-address"
        >{t("search")}</Button>
      </div>
      {/* Autocomplete Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {predictions.map((prediction, index) => (
            <div
              key={prediction.place_id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
              onClick={() => handlePlaceSelect(prediction)}
              data-testid={`option-address-${index}`}
            >
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {prediction.structured_formatting?.main_text || prediction.description}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {prediction.structured_formatting?.secondary_text || ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}