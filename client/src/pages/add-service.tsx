import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { insertServiceSchema, type InsertService, type Profile } from "@shared/schema";
import { ITALIAN_PROVINCES } from "@shared/provinces";
import CityPicker from "@/components/city-picker";
import AppHeader from "@/components/app-header";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { optionLabel } from "@/lib/optionLabels";
import type { TranslationKey } from "@/lib/translations";

type Translate = (key: TranslationKey) => string;

// Extended schema for the add service form
const buildAddServiceSchema = (t: Translate) => insertServiceSchema.extend({
  // Ensure required fields
  title: z.string().min(1, t("serviceTitleRequiredError")),
  description: z.string().min(10, t("descriptionMinError")),
  serviceType: z.string().min(1, t("selectServiceTypeError")),
  location: z.string().min(1, t("locationRequiredError")),
  availability: z.string().min(1, t("availabilityRequiredError")),
  ageGroups: z.string().min(1, t("ageGroupsRequiredError")),
  hourlyRate: z.number({ invalid_type_error: t("invalidRateError") }).min(0, t("invalidRateError")).optional(),
}).omit({
  providerId: true, // Will be set by backend
  isAvailable: true, // Default value
});

type AddServiceFormData = z.infer<ReturnType<typeof buildAddServiceSchema>>;

const serviceTypes = [
  { value: "Babysitting" },
  { value: "Tutoring" },
  { value: "Cleaning" },
  { value: "Pet Care" },
  { value: "Meal Prep" },
  { value: "Transportation" },
  { value: "Elderly Care" },
  { value: "Personal Training" },
  { value: "Music Lessons" },
  { value: "Language Tutoring" },
  { value: "Other" }
];

const ageGroupOptions = [
  "0-2 anni",
  "3-5 anni", 
  "6-12 anni",
  "13+ anni",
  "Adulti",
  "Tutte le età"
];

export default function AddService() {
  const [, setLocation] = useLocation();
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
  // Free-text price editing (comma or dot decimals), parsed on change
  const [rateText, setRateText] = useState("");
  const { toast } = useToast();
  const { t } = useLanguage();
  const addServiceSchema = useMemo(() => buildAddServiceSchema(t), [t]);
  const queryClient = useQueryClient();

  const form = useForm<AddServiceFormData>({
    resolver: zodResolver(addServiceSchema),
    defaultValues: {
      title: "",
      description: "",
      serviceType: "",
      hourlyRate: undefined,
      location: "",
      availability: "",
      experience: "",
      certifications: "",
      ageGroups: "",
    },
  });

  // Prefill the city with the provider's own province: most moms offer where they live.
  const { data: myProfile } = useQuery<Profile>({ queryKey: ["/api/profiles", "current-user"] });
  useEffect(() => {
    if (myProfile?.location && ITALIAN_PROVINCES.includes(myProfile.location) && !form.getValues("location")) {
      form.setValue("location", myProfile.location);
    }
  }, [myProfile?.location, form]);

  const createServiceMutation = useMutation({
    mutationFn: async (data: AddServiceFormData) => {
      // Convert hourly rate to cents if provided
      const serviceData = {
        ...data,
        hourlyRate: data.hourlyRate ? Math.round(data.hourlyRate * 100) : undefined,
      };
      
      const response = await apiRequest("POST", "/api/services", serviceData);
      if (!response.ok) {
        throw new Error(t("serviceCreateFailed"));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: t("servicePublished"),
        description: t("servicePublishedDescription"),
      });
      setLocation("/marketplace");
    },
    onError: (error) => {
      toast({
        title: t("error"),
        description: t("serviceCreateFailed"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddServiceFormData) => {
    // Combine selected age groups into a single string
    const finalData = {
      ...data,
      ageGroups: selectedAgeGroups.join(", "),
    };
    createServiceMutation.mutate(finalData);
  };

  const addAgeGroup = (ageGroup: string) => {
    if (!selectedAgeGroups.includes(ageGroup)) {
      const newGroups = [...selectedAgeGroups, ageGroup];
      setSelectedAgeGroups(newGroups);
      form.setValue("ageGroups", newGroups.join(", "));
    }
  };

  const removeAgeGroup = (ageGroup: string) => {
    const newGroups = selectedAgeGroups.filter(g => g !== ageGroup);
    setSelectedAgeGroups(newGroups);
    form.setValue("ageGroups", newGroups.join(", "));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <AppHeader title={t("addService")} backTo="/marketplace" right={null} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-5">
          <p className="text-[15px] leading-relaxed text-gray-600">{t("shareSkillsSubtitle")}</p>

          {/* Basic Information */}
          <section className="space-y-2.5">
            <h2 className="section-label">{t("basicInfo")}</h2>
            <div className="card-float space-y-4 p-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("serviceTitleRequired")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("serviceTitlePlaceholder")}
                        {...field}
                        data-testid="input-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("descriptionRequired")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("serviceDescriptionPlaceholder")}
                        className="min-h-[120px]"
                        {...field}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("serviceTypeRequired")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-service-type">
                          <SelectValue placeholder={t("selectServiceType")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {optionLabel(t, type.value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Rate and city */}
          <section className="space-y-2.5">
            <h2 className="section-label">{t("priceAndLocation")}</h2>
            <div className="card-float space-y-4 p-5">
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("hourlyRate")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display font-semibold text-gray-900">€</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder={t("marketRatePlaceholder")}
                          className="pl-9"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={rateText}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d.,]/g, "");
                            setRateText(raw);
                            const parsed = parseFloat(raw.replace(",", "."));
                            field.onChange(Number.isFinite(parsed) ? parsed : undefined);
                          }}
                          data-testid="input-hourly-rate"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("cityRequired")}</FormLabel>
                    <FormControl>
                      <CityPicker value={field.value ?? ""} onChange={field.onChange} testId="input-location" />
                    </FormControl>
                    <p className="text-xs leading-relaxed text-gray-600">{t("cityOfferHint")}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Availability & Experience */}
          <section className="space-y-2.5">
            <h2 className="section-label">{t("availabilityAndExperience")}</h2>
            <div className="card-float space-y-4 p-5">
              <FormField
                control={form.control}
                name="availability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("availabilityRequired")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("availabilityPlaceholder")}
                        {...field}
                        data-testid="textarea-availability"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="experience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("yearsOfExperience")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("experiencePlaceholder")}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-experience"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="certifications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("certifications")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("certificationsPlaceholder")}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-certifications"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Age Groups */}
          <section className="space-y-2.5">
            <h2 className="section-label">{t("ageGroupsRequired")}</h2>
            <div className="card-float space-y-4 p-5">
              <p className="text-sm leading-relaxed text-gray-600">{t("selectAgeGroups")}</p>
              <div className="flex flex-wrap gap-2.5">
                {ageGroupOptions.map((ageGroup) => {
                  const selected = selectedAgeGroups.includes(ageGroup);
                  return (
                    <button
                      key={ageGroup}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selected ? removeAgeGroup(ageGroup) : addAgeGroup(ageGroup)}
                      className={selected ? "chip chip-lg chip-on" : "chip chip-lg bg-gray-50"}
                      data-testid={`button-age-${ageGroup.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {selected && <Check className="h-4 w-4 text-pink-500" strokeWidth={2.6} />}
                      {optionLabel(t, ageGroup)}
                    </button>
                  );
                })}
              </div>

              <FormField
                control={form.control}
                name="ageGroups"
                render={({ field }) => (
                  // Hidden field: no gap of its own unless it shows an error
                  <FormItem className="!mt-0 space-y-0">
                    <FormControl>
                      <Input
                        {...field}
                        type="hidden"
                        data-testid="input-age-groups-hidden"
                      />
                    </FormControl>
                    <FormMessage className="pt-4" />
                  </FormItem>
                )}
              />

              {form.formState.errors.ageGroups && selectedAgeGroups.length === 0 && (
                <p className="text-sm font-medium text-destructive">
                  {t("selectAtLeastOneAgeGroup")}
                </p>
              )}
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={createServiceMutation.isPending}
              className="w-full"
              data-testid="button-create-service"
            >
              {createServiceMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t("publishing")}
                </>
              ) : (
                t("publishService")
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLocation("/marketplace")}
              className="w-full text-gray-600"
              data-testid="button-cancel"
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
