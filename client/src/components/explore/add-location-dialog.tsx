import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import GooglePlacesAutocomplete from "@/components/google-places-autocomplete";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// Category keys for translation
const addLocationCategoryKeys = ["categoryPark", "categoryCafe", "categoryPlayground", "categoryLibrary", "categoryWaterPark", "categoryActivityCenter", "categoryRestaurants"] as const;
const ageGroupKeys = ["ageAll", "age0to2", "age3to5", "age6to8", "age9to12", "age13plus"] as const;
const amenityKeys = ["amenityParking", "amenityWashrooms", "amenityStrollerFriendly", "amenityHighChair", "amenityNursingRoom", "amenityPlayArea", "amenityOutdoorSpace", "amenityFoodAvailable"] as const;

const addLocationSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  category: z.string().min(1, "La categoria è obbligatoria"),
  address: z.string().min(1, "L'indirizzo è obbligatorio"),
  // Populated from the Google suggestion; may legitimately be empty when
  // Google returns no province component
  province: z.string().default(""),
  description: z.string().min(1, "La descrizione è obbligatoria"),
  imageUrl: z.string().default("https://via.placeholder.com/300x200?text=Location"),
  amenities: z.array(z.string()),
  ageGroups: z.array(z.string()),
  coordinates: z.string().min(1, "Seleziona il luogo dalla ricerca"),
  openingHours: z.string().min(1, "Gli orari di apertura sono obbligatori"),
  googleMapsUrl: z.string().optional()
});

interface AddLocationDialogProps {
  // The element that opens the dialog (rendered through DialogTrigger asChild)
  trigger: ReactNode;
}

// "Suggest a place": Google Places search plus a few details. The place goes
// live after admin approval.
export default function AddLocationDialog({ trigger }: AddLocationDialogProps) {
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

  // name/address/coordinates have no visible form field (they come from the
  // Google search), so a validation failure there must surface as a toast —
  // otherwise the submit button appears dead.
  const onInvalid = (errors: Record<string, any>) => {
    const firstError = Object.values(errors).find(
      (e: any) => typeof e?.message === "string" && e.message,
    ) as { message?: string } | undefined;
    toast({
      title: t("error"),
      description: firstError?.message,
      variant: "destructive",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("addNewLocation")}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            {/* Google Places Search */}
            <div className="space-y-2">
              <FormLabel>{t("searchForPlace")}</FormLabel>
              <GooglePlacesAutocomplete
                onPlaceSelect={handlePlaceSelect}
                placeholder={t("searchPlaceholder")}
                className="w-full"
              />
              {selectedPlace && (
                <div className="flex items-start gap-2 rounded-2xl bg-pink-50 p-3 text-sm text-pink-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t("selectedPlace")} <strong>{selectedPlace.name}</strong>
                    <br />
                    <span className="text-xs text-gray-600">{selectedPlace.address}</span>
                  </span>
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
                  <FormLabel>{t("googleMapsLinkOptional")}</FormLabel>
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
