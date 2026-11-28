import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { updateProfileSchema, type UpdateProfile, type Profile } from "@shared/schema";
import { normalizeInstagramUrl } from "@shared/instagram";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Plus, X, Upload, Check, ChevronsUpDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import PageSkeleton from "@/components/page-skeleton";
import AppHeader from "@/components/app-header";

const ITALIAN_PROVINCES = [
  "Agrigento", "Alessandria", "Ancona", "Aosta", "Arezzo", "Ascoli Piceno", "Asti", "Avellino",
  "Bari", "Barletta-Andria-Trani", "Belluno", "Benevento", "Bergamo", "Biella", "Bologna", "Bolzano", "Brescia", "Brindisi",
  "Cagliari", "Caltanissetta", "Campobasso", "Caserta", "Catania", "Catanzaro", "Chieti", "Como", "Cosenza", "Cremona", "Crotone", "Cuneo",
  "Enna",
  "Fermo", "Ferrara", "Firenze", "Foggia", "Forlì-Cesena", "Frosinone",
  "Genova", "Gorizia", "Grosseto",
  "Imperia", "Isernia",
  "La Spezia", "L'Aquila", "Latina", "Lecce", "Lecco", "Livorno", "Lodi", "Lucca",
  "Macerata", "Mantova", "Massa-Carrara", "Matera", "Messina", "Milano", "Modena", "Monza e Brianza",
  "Napoli", "Novara", "Nuoro",
  "Oristano",
  "Padova", "Palermo", "Parma", "Pavia", "Perugia", "Pesaro e Urbino", "Pescara", "Piacenza", "Pisa", "Pistoia", "Pordenone", "Potenza", "Prato",
  "Ragusa", "Ravenna", "Reggio Calabria", "Reggio Emilia", "Rieti", "Rimini", "Roma", "Rovigo",
  "Salerno", "Sassari", "Savona", "Siena", "Siracusa", "Sondrio",
  "Taranto", "Teramo", "Terni", "Torino", "Trapani", "Trento", "Treviso", "Trieste",
  "Udine",
  "Varese", "Venezia", "Verbano-Cusio-Ossola", "Vercelli", "Verona", "Vibo Valentia", "Vicenza", "Viterbo"
];

const CURRENT_USER_ID = "current-user";

const SECTION = "card-float space-y-4 p-5";
const SECTION_LABEL = "section-label font-sans tracking-normal";

export default function ProfileEdit() {
  const [hobbiesInput, setHobbiesInput] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast} = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["/api/profiles", CURRENT_USER_ID],
  });
  const isProfessional = profile?.accountType === "professional";

  const form = useForm<UpdateProfile>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      age: profile?.age || 18,
      sex: profile?.sex || undefined,
      bio: profile?.bio || "",
      location: profile?.location || "",
      photoUrls: profile?.photoUrls || [],
      kidsNumber: profile?.kidsNumber || 1,
      kidsAges: profile?.kidsAges || [],
      kidsGenders: profile?.kidsGenders || [],
      hobbies: profile?.hobbies || [],
      vintedUrl: profile?.vintedUrl || "",
      instagramUrl: profile?.instagramUrl || "",
      businessName: profile?.businessName || "",
      professionalCategory: profile?.professionalCategory || "",
    },
  });

  // Update form when profile data is loaded. Must be an effect keyed on the
  // query result: with useState this ran once before the profile arrived and
  // saving the still-empty form wiped the real profile.
  useEffect(() => {
    if (profile) {
      form.reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        age: profile.age,
        sex: profile.sex,
        bio: profile.bio,
        location: profile.location,
        photoUrls: profile.photoUrls,
        kidsNumber: profile.kidsNumber,
        kidsAges: profile.kidsAges,
        kidsGenders: profile.kidsGenders,
        hobbies: profile.hobbies,
        vintedUrl: profile.vintedUrl,
        instagramUrl: profile.instagramUrl || "",
        businessName: profile.businessName || "",
        professionalCategory: profile.professionalCategory || "",
      });
      setUploadedPhotos(profile.photoUrls);
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateProfile) => {
      const response = await apiRequest("PUT", `/api/profiles/${CURRENT_USER_ID}`, data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate every cache holding profile data (own profile, map markers,
      // matches/conversations embed the profile too)
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/map"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      toast({
        title: t("profileUpdated"),
        description: t("profileUpdatedSuccess"),
      });
      
      // Navigate back to profile page
      setLocation("/profile");
    },
    onError: (error: any) => {
      toast({
        title: t("updateFailed"),
        description: error.message || t("updateFailedMessage"),
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload/public");
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: any) => {
    const uploadedFiles = result.successful;
    if (uploadedFiles.length > 0) {
      const newPhotoUrls = uploadedFiles.map((file: any) => file.uploadURL);
      setUploadedPhotos(prev => {
        const updatedPhotos = [...prev, ...newPhotoUrls];
        form.setValue("photoUrls", updatedPhotos);
        return updatedPhotos;
      });
      
      toast({
        title: t("photosUploaded"),
        description: `${uploadedFiles.length} ${t("photosUploadedSuccess")}`,
      });
    }
  };

  const removePhoto = (indexToRemove: number) => {
    const newPhotos = uploadedPhotos.filter((_, index) => index !== indexToRemove);
    setUploadedPhotos(newPhotos);
    form.setValue("photoUrls", newPhotos);
  };

  const addHobby = () => {
    const hobby = hobbiesInput.trim();
    if (hobby && !form.getValues("hobbies")?.includes(hobby)) {
      const currentHobbies = form.getValues("hobbies") || [];
      form.setValue("hobbies", [...currentHobbies, hobby]);
      setHobbiesInput("");
    }
  };

  const removeHobby = (hobbyToRemove: string) => {
    const currentHobbies = form.getValues("hobbies") || [];
    form.setValue("hobbies", currentHobbies.filter(hobby => hobby !== hobbyToRemove));
  };

  const onSubmit = (data: UpdateProfile) => {
    const instagramUrl = normalizeInstagramUrl(data.instagramUrl);
    if (instagramUrl === null) {
      form.setError("instagramUrl", { message: t("instagramInvalid") });
      return;
    }
    updateMutation.mutate({
      ...data,
      instagramUrl: instagramUrl || null,
      photoUrls: uploadedPhotos,
    });
  };

  if (isLoading) {
    return (
      <PageSkeleton variant="form" />
    );
  }

  const kidsNumber = form.watch("kidsNumber");
  const kidsAges = form.watch("kidsAges");
  const kidsGenders = form.watch("kidsGenders");
  const hobbies = form.watch("hobbies") || [];

  // Note: a missing profile is fine here — the form renders with empty
  // defaults and saving creates the profile (legacy accounts without one).

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(2.5rem_+_env(safe-area-inset-bottom))]">
      <AppHeader title={t("editProfileTitle")} backTo="/profile" right={null} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-5 px-5 pt-1">
          {/* Professional business info */}
          {isProfessional && (
            <section className={SECTION}>
              <h2 className={SECTION_LABEL}>{t("professionalAccount")}</h2>
              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("businessNameLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("businessNamePlaceholder")}
                        data-testid="input-businessName"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="professionalCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("professionalCategoryLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("selectProfessionalCategory")}
                        data-testid="input-professionalCategory"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          )}

          {/* Basic Info */}
          <section className={SECTION}>
            <h2 className={SECTION_LABEL}>{isProfessional ? t("referentName") : t("basicInformation")}</h2>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("firstName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("yourFirstName")} data-testid="input-firstName" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lastName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("yourLastName")} data-testid="input-lastName" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("age")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="18"
                        max="65"
                        data-testid="input-age"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("gender")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined} data-testid="select-sex">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectGender")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="female">{t("female")}</SelectItem>
                        <SelectItem value="male">{t("male")}</SelectItem>
                        <SelectItem value="other">{t("other")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("province")}</FormLabel>
                  <Popover open={provinceOpen} onOpenChange={setProvinceOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={provinceOpen}
                          className={`h-12 w-full justify-between px-4 text-base font-normal ${field.value ? "" : "text-muted-foreground"}`}
                          data-testid="select-province"
                        >
                          {field.value
                            ? ITALIAN_PROVINCES.find((province) => province === field.value)
                            : t("selectProvince")}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t("searchProvince")} />
                        <CommandList>
                          <CommandEmpty>{t("noProvinceFound")}</CommandEmpty>
                          <CommandGroup>
                            {ITALIAN_PROVINCES.map((province) => (
                              <CommandItem
                                key={province}
                                value={province}
                                onSelect={(currentValue) => {
                                  field.onChange(currentValue === field.value ? "" : currentValue);
                                  setProvinceOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    field.value === province ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {province}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vintedUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("vintedAccountOptional")}</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder={t("vintedUrlPlaceholder")}
                      data-testid="input-vinted-url"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <p className="text-[13px] leading-snug text-gray-600">
                    {t("linkYourVintedAccount")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instagramUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("instagramLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={t("instagramPlaceholder")}
                      data-testid="input-instagram-url"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <p className="text-[13px] leading-snug text-gray-600">
                    {t("instagramHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Photos */}
          <section className={SECTION}>
            <div className="space-y-2">
              <h2 className={SECTION_LABEL}>{t("profilePhotos")}</h2>
              <p className="text-[13px] leading-snug text-gray-600">{t("addPhotosMessage")}</p>
            </div>

            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {uploadedPhotos.map((photoUrl, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={photoUrl}
                      alt={`${t("profilePhoto")} ${index + 1}`}
                      className="h-full w-full rounded-[20px] bg-gray-100 object-cover"
                    />
                    <button
                      type="button"
                      className="glass absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-gray-900"
                      onClick={() => removePhoto(index)}
                      aria-label={t("delete")}
                      data-testid={`button-remove-photo-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadedPhotos.length < 5 && (
              <ObjectUploader
                maxNumberOfFiles={5 - uploadedPhotos.length}
                maxFileSize={5 * 1024 * 1024} // 5MB
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="h-12 w-full"
              >
                <Upload />
                {t("uploadPhotos")} ({uploadedPhotos.length}/5)
              </ObjectUploader>
            )}
          </section>

          {/* Bio */}
          <section className={SECTION}>
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <h2 className={SECTION_LABEL} aria-hidden="true">{t("aboutYou")}</h2>
                  <FormLabel className="sr-only">{t("aboutYou")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("tellAboutYourself")}
                      className="min-h-[120px]"
                      data-testid="textarea-bio"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Kids Info */}
          <section className={`${SECTION} ${isProfessional ? "hidden" : ""}`}>
            <h2 className={SECTION_LABEL}>{t("aboutYourKids")}</h2>

            <FormField
              control={form.control}
              name="kidsNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("numberOfKids")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="10"
                      data-testid="input-kidsNumber"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dynamic age and gender inputs for each kid */}
            {(kidsNumber ?? 0) > 0 && (
              <div className="space-y-3">
                {Array.from({ length: kidsNumber || 1 }, (_, index) => {
                  const gender = kidsGenders?.[index] || "";
                  return (
                    <div key={index} className="space-y-3 rounded-[20px] bg-gray-50 p-4">
                      <h3 className="font-sans text-sm font-semibold tracking-normal text-gray-900">{t("kid")} {index + 1}</h3>
                      <div className="flex items-end gap-3">
                        <FormField
                          control={form.control}
                          name={`kidsAges.${index}` as any}
                          render={() => (
                            <FormItem className="w-24 shrink-0">
                              <FormLabel>{t("age")}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  max="18"
                                  placeholder={t("age")}
                                  data-testid={`input-kid-age-${index}`}
                                  value={kidsAges?.[index] || ""}
                                  onChange={(e) => {
                                    const currentAges = form.getValues("kidsAges") || [];
                                    const newAges = [...currentAges];
                                    newAges[index] = e.target.value;
                                    form.setValue("kidsAges", newAges);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`kidsGenders.${index}` as any}
                          render={() => (
                            <FormItem className="min-w-0 flex-1">
                              <div className="flex flex-wrap gap-2" role="group" aria-label={t("gender")} data-testid={`select-kid-gender-${index}`}>
                                {([["male", t("kidBoy")], ["female", t("kidGirl")]] as const).map(([value, label]) => {
                                  const active = gender === value;
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      className={`chip chip-lg ${active ? "chip-on pl-3" : ""}`}
                                      aria-pressed={active}
                                      onClick={() => {
                                        const currentGenders = form.getValues("kidsGenders") || [];
                                        const newGenders = [...currentGenders];
                                        newGenders[index] = value;
                                        form.setValue("kidsGenders", newGenders);
                                      }}
                                      data-testid={`chip-kid-gender-${index}-${value}`}
                                    >
                                      {active && <Check className="h-4 w-4 text-pink-500" strokeWidth={2.6} />}
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Hobbies */}
          <section className={`${SECTION} ${isProfessional ? "hidden" : ""}`}>
            <h2 className={SECTION_LABEL}>{t("hobbiesInterests")}</h2>

            {hobbies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {hobbies.map((hobby, index) => (
                  <span key={index} className="chip chip-lg chip-on pr-1.5">
                    {hobby}
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      onClick={() => removeHobby(hobby)}
                      aria-label={`${t("delete")} ${hobby}`}
                      data-testid={`button-remove-hobby-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder={t("addHobby")}
                aria-label={t("addHobby")}
                value={hobbiesInput}
                onChange={(e) => setHobbiesInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHobby();
                  }
                }}
                data-testid="input-hobby"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={addHobby}
                aria-label={t("addHobby")}
                data-testid="button-add-hobby"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </section>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={updateMutation.isPending}
              data-testid="button-save"
            >
              {updateMutation.isPending ? t("saving") : t("saveChanges")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-gray-600"
              onClick={() => setLocation("/profile")}
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
