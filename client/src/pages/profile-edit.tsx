import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { updateProfileSchema, type UpdateProfile, type Profile } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ArrowLeft, Plus, X, Upload, Check, ChevronsUpDown } from "lucide-react";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import { useLanguage } from "@/contexts/LanguageContext";

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
    },
  });

  // Update form when profile data is loaded
  useState(() => {
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
      });
      setUploadedPhotos(profile.photoUrls);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateProfile) => {
      const response = await apiRequest("PUT", `/api/profiles/${CURRENT_USER_ID}`, data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate profile queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      
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
    updateMutation.mutate({
      ...data,
      photoUrls: uploadedPhotos,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-pink"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">{t("profileNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full"
                onClick={() => setLocation("/profile")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Button>
              <div className="text-center flex items-center">
                <img 
                  src={heyMamaLogo} 
                  alt="HeyMama" 
                  className="h-10 w-auto object-contain"
                />
              </div>
              <div className="w-10"></div> {/* Spacer for balance */}
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
              {t("editProfileTitle")}
            </CardTitle>
            <CardDescription>
              {t("updateInfo")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t("basicInformation")}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="18"
                              max="65"
                              data-testid="input-age"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
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
                          <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-sex">
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
                                variant="outline"
                                role="combobox"
                                aria-expanded={provinceOpen}
                                className="w-full justify-between"
                                data-testid="select-province"
                              >
                                {field.value
                                  ? ITALIAN_PROVINCES.find((province) => province === field.value)
                                  : t("selectProvince")}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
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
                            placeholder={t("vintedUrlPlaceholder")}
                            data-testid="input-vinted-url"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          {t("linkYourVintedAccount")}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Photos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t("profilePhotos")}</h3>
                  <p className="text-sm text-muted-foreground">{t("addPhotosMessage")}</p>
                  
                  {uploadedPhotos.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {uploadedPhotos.map((photoUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photoUrl}
                            alt={`${t("profilePhoto")} ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removePhoto(index)}
                            data-testid={`button-remove-photo-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
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
                      buttonClassName="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {t("uploadPhotos")} ({uploadedPhotos.length}/5)
                    </ObjectUploader>
                  )}
                </div>

                {/* Bio */}
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("aboutYou")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("tellAboutYourself")}
                          className="min-h-[100px]"
                          data-testid="textarea-bio"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Kids Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t("aboutYourKids")}</h3>
                  
                  <FormField
                    control={form.control}
                    name="kidsNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("numberOfKids")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
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
                  {form.watch("kidsNumber") > 0 && (
                    <div className="space-y-3">
                      <FormLabel>{t("kidsInformation")}</FormLabel>
                      <div className="space-y-4">
                        {Array.from({ length: form.watch("kidsNumber") || 1 }, (_, index) => (
                          <div key={index} className="p-4 border rounded-lg bg-gray-50">
                            <h4 className="font-medium mb-3 text-gray-800">{t("kid")} {index + 1}</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <FormField
                                control={form.control}
                                name={`kidsAges.${index}` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">{t("age")}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        max="18"
                                        placeholder={t("age")}
                                        data-testid={`input-kid-age-${index}`}
                                        value={form.getValues("kidsAges")?.[index] || ""}
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
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">{t("gender")}</FormLabel>
                                    <Select
                                      onValueChange={(value) => {
                                        const currentGenders = form.getValues("kidsGenders") || [];
                                        const newGenders = [...currentGenders];
                                        newGenders[index] = value;
                                        form.setValue("kidsGenders", newGenders);
                                      }}
                                      value={form.getValues("kidsGenders")?.[index] || ""}
                                      data-testid={`select-kid-gender-${index}`}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder={t("select")} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="male">{t("boy")}</SelectItem>
                                        <SelectItem value="female">{t("girl")}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hobbies */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t("hobbiesInterests")}</h3>
                  
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("addHobby")}
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
                      onClick={addHobby}
                      data-testid="button-add-hobby"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {(form.watch("hobbies")?.length || 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.watch("hobbies")?.map((hobby, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {hobby}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => removeHobby(hobby)}
                            data-testid={`button-remove-hobby-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setLocation("/profile")}
                    data-testid="button-cancel"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                    disabled={updateMutation.isPending}
                    data-testid="button-save"
                  >
                    {updateMutation.isPending ? t("saving") : t("saveChanges")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}