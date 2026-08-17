import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Clock, Star, Filter, Search, Plus, X, Briefcase, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LocationModal from "@/components/location-modal";
import GooglePlacesAutocomplete from "@/components/google-places-autocomplete";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Location, Profile, Service } from "@shared/schema";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import barImage from "@assets/bar_1757514529485.jpg";
import libraryImage from "@assets/library_1757514529486.jpg";
import parkImage from "@assets/park_1757514529486.jpg";
import playgroundImage from "@assets/playground_1757514529486.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/lib/translations";
import PageSkeleton from "@/components/page-skeleton";

// Category keys for translation
const categoryKeys = ["categoryAll", "categoryPark", "categoryCafe", "categoryPlayground", "categoryLibrary", "categoryWaterPark", "categoryActivityCenter", "categoryRestaurants"] as const;
const addLocationCategoryKeys = ["categoryPark", "categoryCafe", "categoryPlayground", "categoryLibrary", "categoryWaterPark", "categoryActivityCenter", "categoryRestaurants"] as const;
const ageGroupKeys = ["ageAll", "age0to2", "age3to5", "age6to8", "age9to12", "age13plus"] as const;
const amenityKeys = ["amenityParking", "amenityWashrooms", "amenityStrollerFriendly", "amenityHighChair", "amenityNursingRoom", "amenityPlayArea", "amenityOutdoorSpace", "amenityFoodAvailable"] as const;

const addLocationSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  category: z.string().min(1, "La categoria è obbligatoria"),
  address: z.string().min(1, "L'indirizzo è obbligatorio"),
  province: z.string().min(1, "La provincia è obbligatoria"),
  description: z.string().min(1, "La descrizione è obbligatoria"),
  imageUrl: z.string().default("https://via.placeholder.com/300x200?text=Location"),
  amenities: z.array(z.string()),
  ageGroups: z.array(z.string()),
  coordinates: z.string().min(1, "Seleziona il luogo dalla ricerca"),
  openingHours: z.string().min(1, "Gli orari di apertura sono obbligatori"),
  googleMapsUrl: z.string().optional()
});

interface LocationWithReviews extends Location {
  distance?: number;
  reviewCount?: number;
  averageRating?: number;
  momReviewCount?: number;
  momAverageRating?: number;
}

function AddLocationDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{name: string, address: string, coordinates: string} | null>(null);
  const [alwaysOpen, setAlwaysOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const form = useForm<z.infer<typeof addLocationSchema>>({
    resolver: zodResolver(addLocationSchema),
    defaultValues: {
      name: "",
      category: "",
      address: "",
      province: "",
      description: "",
      imageUrl: "https://via.placeholder.com/300x200?text=Location",
      amenities: [],
      ageGroups: [],
      coordinates: "",
      openingHours: "",
      googleMapsUrl: ""
    }
  });

  const addLocationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addLocationSchema>) => {
      return await apiRequest('POST', '/api/locations', data);
    },
    onSuccess: () => {
      // Invalidate all location-related queries using partial key matching
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/locations/nearby'] });
      toast({
        title: t("locationSubmitted"),
        description: t("locationPendingApproval")
      });
      setIsOpen(false);
      form.reset();
      setSelectedPlace(null);
      setAlwaysOpen(false);
    },
    onError: (error: any) => {
      const isAuthError = error.message && error.message.includes('401');
      const isSubscriptionError = error.message && error.message.includes('402');
      
      let title = t("error");
      let description = t("somethingWentWrong");
      
      if (isAuthError) {
        title = t("error");
        description = t("somethingWentWrong");
      } else if (isSubscriptionError) {
        title = t("error");
        description = t("somethingWentWrong");
      } else if (error.message) {
        description = error.message;
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      });
    }
  });

  const handlePlaceSelect = (place: {place_id: string, description: string, lat: number, lng: number, name?: string, province?: string}) => {
    const locationName = place.name || place.description.split(',')[0];
    setSelectedPlace({
      name: locationName,
      address: place.description,
      coordinates: `${place.lat}, ${place.lng}`
    });
    
    form.setValue('name', locationName);
    form.setValue('address', place.description);
    form.setValue('coordinates', `${place.lat}, ${place.lng}`);
    form.setValue('province', place.province || '');
    form.setValue('imageUrl', 'https://via.placeholder.com/300x200?text=Location');
  };

  const onSubmit = (data: z.infer<typeof addLocationSchema>) => {
    addLocationMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="icon" 
          className="h-10 w-10 rounded-full text-white shadow-lg"
          data-testid="button-add-location"
          style={{ 
            background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
          }}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("addNewLocation")}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Google Places Search */}
            <div className="space-y-2">
              <FormLabel>{t("searchForPlace")}</FormLabel>
              <GooglePlacesAutocomplete
                onPlaceSelect={handlePlaceSelect}
                placeholder={t("searchPlaceholder")}
                className="w-full"
              />
              {selectedPlace && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                  ✓ {t("selectedPlace")} <strong>{selectedPlace.name}</strong>
                  <br />
                  <span className="text-xs text-gray-600">{selectedPlace.address}</span>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("category")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectCategory")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {addLocationCategoryKeys.map(categoryKey => (
                        <SelectItem key={categoryKey} value={t(categoryKey)}>{t(categoryKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t("describePlace")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="googleMapsUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link Google Maps (opzionale)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://maps.app.goo.gl/..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="openingHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("openingHours")}</FormLabel>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="always-open"
                        checked={alwaysOpen}
                        onCheckedChange={(checked) => {
                          setAlwaysOpen(!!checked);
                          if (checked) {
                            field.onChange(t("alwaysOpen"));
                          } else {
                            field.onChange("");
                          }
                        }}
                      />
                      <FormLabel htmlFor="always-open" className="font-normal">
                        {t("alwaysOpen")}
                      </FormLabel>
                    </div>
                    {!alwaysOpen && (
                      <FormControl>
                        <Input 
                          placeholder={t("openingHoursPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>{t("ageGroups")}</FormLabel>
              {ageGroupKeys.map(ageKey => {
                const ageValue = t(ageKey);
                return (
                  <FormField
                    key={ageKey}
                    control={form.control}
                    name="ageGroups"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(ageValue)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, ageValue])
                                : field.onChange(field.value?.filter((value) => value !== ageValue))
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {ageValue}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>

            <div className="space-y-3">
              <FormLabel>{t("amenities")}</FormLabel>
              {amenityKeys.map(amenityKey => {
                const amenityValue = t(amenityKey);
                return (
                  <FormField
                    key={amenityKey}
                    control={form.control}
                    name="amenities"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(amenityValue)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, amenityValue])
                                : field.onChange(field.value?.filter((value) => value !== amenityValue))
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {amenityValue}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                {t("cancel")}
              </Button>
              <Button 
                type="submit" 
                disabled={addLocationMutation.isPending}
                className="flex-1"
                data-testid="button-submit-location"
              >
                {addLocationMutation.isPending ? t("adding") : t("addLocation")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


interface ProfessionalWithServices extends Profile {
  services: Service[];
}

// "Professionisti" tab: local professional accounts with the services they offer
function ProfessionalsTab() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const { data: professionals = [], isLoading } = useQuery<ProfessionalWithServices[]>({
    queryKey: ["/api/professionals"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-2xl skeleton-shimmer" />
        ))}
      </div>
    );
  }

  if (professionals.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)" }}
        >
          <Briefcase className="h-8 w-8" style={{ color: "var(--primary-pink)" }} />
        </div>
        <h3 className="font-semibold text-gray-900">{t("noProfessionalsYet")}</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">{t("professionalsIntro")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {professionals.map((pro) => {
        const displayName = pro.businessName || `${pro.firstName} ${pro.lastName}`.trim();
        const firstService = pro.services[0];
        return (
          <div
            key={pro.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            data-testid={`professional-card-${pro.id}`}
          >
            <div className="flex p-4 gap-3">
              {pro.photoUrls?.[0] ? (
                <img
                  src={pro.photoUrls[0]}
                    loading="lazy"
                    decoding="async"
                  alt={displayName}
                  className="w-16 h-16 object-cover rounded-xl flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-7 w-7 text-pink-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
                {pro.professionalCategory && (
                  <Badge variant="secondary" className="mt-1 bg-pink-50 text-pink-700 border-0 text-xs">
                    {pro.professionalCategory}
                  </Badge>
                )}
                {pro.location && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{pro.location}</span>
                  </div>
                )}
              </div>
            </div>

            {pro.bio && (
              <p className="px-4 -mt-1 pb-1 text-sm text-gray-600 line-clamp-2">{pro.bio}</p>
            )}

            {pro.services.length > 0 && (
              <div className="px-4 py-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  {t("servicesOffered")}
                </p>
                <div className="space-y-1.5">
                  {pro.services.slice(0, 3).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate">{s.title}</span>
                      {s.hourlyRate != null && (
                        <span className="font-medium shrink-0 ml-2" style={{ color: "var(--primary-pink)" }}>
                          €{(s.hourlyRate / 100).toFixed(0)}{t("perHour")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {firstService && (
              <div className="px-4 pb-4 pt-1">
                <Button
                  className="w-full rounded-full text-white"
                  style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
                  onClick={() => setLocation(`/market-chat/service:${firstService.id}/${pro.userId}`)}
                  data-testid={`button-contact-${pro.id}`}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {t("contact")}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getCategoryImage(category: string): string {
  const categoryLower = category.toLowerCase();
  if (categoryLower.includes('bar') || categoryLower.includes('cafe')) {
    return barImage;
  } else if (categoryLower.includes('library')) {
    return libraryImage;
  } else if (categoryLower.includes('playground')) {
    return playgroundImage;
  } else {
    return parkImage; // Default to park for parks, water parks, etc.
  }
}

export default function Locations() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("categoryAll");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [searchAddress, setSearchAddress] = useState("");
  const { t } = useLanguage();

  useEffect(() => {
    const savedPosition = localStorage.getItem('heymama-map-position');
    if (savedPosition) {
      try {
        const { center } = JSON.parse(savedPosition);
        if (center && center.lat && center.lng) {
          setUserLocation({ lat: center.lat, lng: center.lng });
        }
      } catch (error) {
        console.error('Failed to load saved map position:', error);
      }
    }
  }, []);

  const { data: locations = [], isLoading } = useQuery<LocationWithReviews[]>({
    queryKey: ["/api/locations/nearby", selectedCategory, userLocation],
    queryFn: async () => {
      if (!userLocation) {
        // If no location selected, return all locations
        const params = new URLSearchParams();
        if (selectedCategory !== "categoryAll") params.append("category", t(selectedCategory as keyof (typeof translations)["it"]));
        const response = await fetch(`/api/locations?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch locations');
        return response.json();
      }
      
      // Get nearby locations with distance
      const params = new URLSearchParams();
      if (selectedCategory !== "categoryAll") params.append("category", t(selectedCategory as keyof (typeof translations)["it"]));
      params.append("lat", userLocation.lat.toString());
      params.append("lng", userLocation.lng.toString());
      params.append("limit", "10");
      
      const response = await fetch(`/api/locations/nearby?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    },
    enabled: true
  });

  const handlePlaceSelect = (place: {place_id: string, description: string, lat: number, lng: number}) => {
    setUserLocation({ lat: place.lat, lng: place.lng });
    setSearchAddress(place.description);
  };

  const filteredLocations = locations;

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  if (isLoading) {
    return (
      <PageSkeleton variant="list" />
    );
  }

  return (
    <Tabs defaultValue="places" className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/85 backdrop-blur-xl shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-center p-4 relative">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">{t("aroundYou")}</h1>
          </div>
          <div className="absolute right-4">
            <AddLocationDialog />
          </div>
        </div>
        {/* Tabs: Luoghi / Professionisti (same pattern as products/services) */}
        <div className="px-4 pb-3">
          <TabsList className="grid w-full grid-cols-2 rounded-full bg-gray-100 p-1">
            <TabsTrigger
              value="places"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
              data-testid="tab-places"
            >
              <MapPin className="h-4 w-4 mr-1.5" />
              {t("places")}
            </TabsTrigger>
            <TabsTrigger
              value="professionals"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
              data-testid="tab-professionals"
            >
              <Briefcase className="h-4 w-4 mr-1.5" />
              {t("professionals")}
            </TabsTrigger>
          </TabsList>
        </div>
      </header>

      <TabsContent value="professionals" className="mt-0 pb-nav">
        <ProfessionalsTab />
      </TabsContent>

      <TabsContent value="places" className="mt-0">
      {/* Search and Filter Section */}
      <div className="p-4 bg-white border-b space-y-4">
        {/* Address Search with Google Places Autocomplete */}
        <GooglePlacesAutocomplete
          onPlaceSelect={handlePlaceSelect}
          placeholder={t("enterCity")}
          className="w-full"
        />
        
        {/* Show selected location */}
        {searchAddress && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <MapPin className="h-4 w-4" />
            <span>{t("showingNear")} <strong>{searchAddress}</strong></span>
            <button 
              onClick={() => {
                setUserLocation(null);
                setSearchAddress("");
              }}
              className="ml-auto text-primary-pink hover:text-primary-pink/80"
            >
              {t("clear")}
            </button>
          </div>
        )}
        
        {/* Category Filter */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">{t("filterByCategory")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryKeys.map((categoryKey) => (
              <button
                key={categoryKey}
                onClick={() => setSelectedCategory(categoryKey)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === categoryKey
                    ? "bg-primary-pink text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                data-testid={`filter-${categoryKey.toLowerCase().replace(' ', '-')}`}
              >
                {t(categoryKey)}
              </button>
            ))}
          </div>
          {selectedCategory !== "categoryAll" && (
            <div className="text-xs text-gray-500">
              {t("showingCategory")} <span className="font-medium text-primary-pink">{t(selectedCategory as keyof (typeof translations)["it"])}</span>
            </div>
          )}
        </div>
      </div>

      {/* Locations List */}
      <div className="p-4 pb-nav">
        {filteredLocations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📍</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("noLocationsFound")}</h2>
            <p className="text-gray-600">{t("tryDifferentCategory")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLocations.map((location) => (
              <div
                key={location.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedLocation(location)}
              >
                <div className="flex p-4 gap-3">
                  {/* Category Image */}
                  <img
                    src={getCategoryImage(location.category)}
                    loading="lazy"
                    decoding="async"
                    alt={location.category}
                    className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                  />
                  
                  {/* Location Info */}
                  <div className="flex-1 min-w-0">
                    {/* Name and Distance */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800 text-base truncate flex-1">{location.name}</h3>
                      {(location as any).distance && (
                        <span className="text-sm text-primary-pink font-medium ml-2">{(location as any).distance} km</span>
                      )}
                    </div>
                    
                    {/* Google Rating and Reviews */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium text-gray-700">{(location as any).averageRating || location.rating}</span>
                      </div>
                      <span className="text-sm text-gray-500">• {(location as any).reviewCount || 0} recensioni</span>
                    </div>

                    
                    {/* Location */}
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{location.address}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </TabsContent>

      {/* Location Modal */}
      {selectedLocation && (
        <LocationModal
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />
      )}
    </Tabs>
  );
}