import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Camera, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { insertMarketplaceItemSchema, type InsertMarketplaceItem, type Profile } from "@shared/schema";
import { ITALIAN_PROVINCES } from "@shared/provinces";
import CityPicker from "@/components/city-picker";
import AppHeader from "@/components/app-header";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { optionLabel } from "@/lib/optionLabels";
import type { TranslationKey } from "@/lib/translations";

type Translate = (key: TranslationKey) => string;

// Extended schema for the add product form
const buildAddProductSchema = (t: Translate) => insertMarketplaceItemSchema.extend({
  // Ensure required fields
  title: z.string().min(1, t("titleRequiredError")),
  description: z.string().min(10, t("descriptionMinError")),
  price: z.number({ invalid_type_error: t("invalidPriceError") }).min(0.01, t("invalidPriceError")),
  category: z.string().min(1, t("selectCategory")),
  brand: z.string().min(1, t("selectBrandError")),
  size: z.string().min(1, t("selectSizeError")),
  condition: z.string().min(1, t("selectConditionError")),
  location: z.string().min(1, t("locationRequiredError")),
}).omit({
  sellerId: true, // Will be set by backend
  isAvailable: true, // Default value
  ageRange: true, // Not used for clothing
});

type AddProductFormData = z.infer<ReturnType<typeof buildAddProductSchema>>;

const categories = [
  { value: "Abbigliamento > Neonati 0-12 mesi" },
  { value: "Abbigliamento > Bambini 1-5 anni" },
  { value: "Calzature > Primi passi" },
  { value: "Calzature > Bambino" },
  { value: "Passeggini e Viaggi > Passeggini" },
  { value: "Passeggini e Viaggi > Seggiolini auto" },
  { value: "Passeggini e Viaggi > Zaini porta bebè" },
  { value: "Alimentazione > Biberon" },
  { value: "Alimentazione > Seggioloni" },
  { value: "Alimentazione > Sterilizzatori" },
  { value: "Giochi e Libri > Peluche" },
  { value: "Giochi e Libri > Giochi educativi" },
  { value: "Giochi e Libri > Libri per bambini" },
  { value: "Cameretta > Lettini" },
  { value: "Cameretta > Fasciatoi" },
  { value: "Cameretta > Decorazioni" },
  { value: "Cura e Igiene > Pannolini" },
  { value: "Cura e Igiene > Bagnetto" },
];

const brands = [
  "Chicco", "Prenatal", "Zippy", "Mayoral", "Petit Bateau", "Carter's", 
  "H&M Kids", "Zara Kids", "OVS Kids", "United Colors of Benetton Kids",
  "Nike Kids", "Adidas Kids", "Converse Kids", "Geox", "Primigi",
  "Cybex", "Maxi-Cosi", "Peg Perego", "Inglesina", "Cam",
  "Avent", "MAM", "Nuk", "Tommee Tippee", "Medela",
  "Fisher-Price", "Clementoni", "Chicco Giochi", "Janod", "Melissa & Doug",
  "IKEA", "Senza marca"
];

const sizes = [
  // Abbigliamento neonati/bambini per età
  "Prematuro", "0-1 mese", "1-3 mesi", "3-6 mesi", "6-9 mesi", "9-12 mesi",
  "12-18 mesi", "18-24 mesi", "2 anni", "3 anni", "4 anni", "5 anni",
  // Taglie numeriche abbigliamento
  "50cm", "56cm", "62cm", "68cm", "74cm", "80cm", "86cm", "92cm", "98cm", "104cm", "110cm", "116cm",
  // Scarpe bambino (EU)
  "Scarpe 16", "Scarpe 17", "Scarpe 18", "Scarpe 19", "Scarpe 20", "Scarpe 21", 
  "Scarpe 22", "Scarpe 23", "Scarpe 24", "Scarpe 25", "Scarpe 26", "Scarpe 27", 
  "Scarpe 28", "Scarpe 29", "Scarpe 30",
  // Prodotti variabili o universali
  "Taglia unica", "Regolabile", "Non applicabile"
];

const conditions = [
  { value: "new-with-tags" },
  { value: "new-without-tags" },
  { value: "excellent" },
  { value: "good" },
  { value: "fair" },
  { value: "damaged" }
];

const colors = [
  "Nero", "Bianco", "Rosso", "Blu", "Verde", "Giallo", "Rosa", "Viola", 
  "Marrone", "Grigio", "Beige", "Arancione", "Multicolore"
];

const materials = [
  "Cotone 100%", "Cotone organico", "Bambù", "Lana merino", "Pile",
  "Poliestere", "Misto cotone", "Jersey", "Mussola", "Spugna",
  "Plastica BPA-free", "Silicone", "Acciaio inox", "Legno",
  "Tessuto impermeabile", "Non specificato"
];

const seasons = [
  { value: "Estivo" },
  { value: "Invernale" },
  { value: "Tutto l'anno" }
];

type UploadedImage = {
  file: File;
  previewUrl: string;
  uploadUrl?: string;
  isUploading: boolean;
  uploadError?: string;
};

export default function AddProduct() {
  const [, setLocation] = useLocation();
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  // Revoke every preview object URL on unmount (removeImage only frees the
  // one it removes)
  const uploadedImagesRef = useRef(uploadedImages);
  uploadedImagesRef.current = uploadedImages;
  useEffect(() => () => {
    uploadedImagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
  }, []);
  // The price is edited as free text (comma or dot decimals) and parsed on
  // change: no pre-filled 0 to fight against while typing.
  const [priceText, setPriceText] = useState("");
  const { toast } = useToast();
  const { t } = useLanguage();
  const addProductSchema = useMemo(() => buildAddProductSchema(t), [t]);
  const queryClient = useQueryClient();

  const form = useForm<AddProductFormData>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      title: "",
      description: "",
      price: undefined as unknown as number,
      category: "",
      brand: "",
      size: "",
      condition: "",
      location: "",
      imageUrls: [],
      negotiable: false,
      color: "",
      material: "",
      season: "",
      measurements: "",
      vintedUrl: "",
    },
  });

  // Prefill the city with the seller's own province: most moms offer where they live.
  const { data: myProfile } = useQuery<Profile>({ queryKey: ["/api/profiles", "current-user"] });
  useEffect(() => {
    if (myProfile?.location && ITALIAN_PROVINCES.includes(myProfile.location) && !form.getValues("location")) {
      form.setValue("location", myProfile.location);
    }
  }, [myProfile?.location, form]);

  // Function to get upload URL from backend (apiRequest adds the bearer token
  // required by native builds, where session cookies are unreliable)
  const getUploadUrl = async (): Promise<string> => {
    const response = await apiRequest('POST', '/api/objects/upload');
    const data = await response.json();
    return data.uploadURL;
  };

  // Function to upload file to cloud storage
  const uploadFileToStorage = async (file: File, uploadUrl: string): Promise<string> => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        // Some pickers return files without a MIME type: fall back to a
        // generic binary type the server accepts instead of an empty header.
        'Content-Type': file.type || 'application/octet-stream',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    // The upload URL (minus any query string) is also the serving URL.
    // Absolute so it works in the native WebView too.
    const url = new URL(uploadUrl);
    return `${url.origin}${url.pathname}`;
  };

  // Function to upload a single image. Identified by its previewUrl (unique
  // per image): using the array index raced with removals — removing an
  // earlier image while an upload was in flight shifted the array and the
  // completion marked the wrong slot.
  const uploadImage = async (file: File, previewUrl: string) => {
    try {
      // Mark as uploading
      setUploadedImages(prev => prev.map((img) =>
        img.previewUrl === previewUrl ? { ...img, isUploading: true, uploadError: undefined } : img
      ));

      // Get upload URL and upload file
      const uploadUrl = await getUploadUrl();
      const objectUrl = await uploadFileToStorage(file, uploadUrl);

      // Mark as completed
      setUploadedImages(prev => prev.map((img) =>
        img.previewUrl === previewUrl ? { ...img, uploadUrl: objectUrl, isUploading: false } : img
      ));

    } catch (error) {
      console.error('Upload error:', error);

      // Mark as failed
      setUploadedImages(prev => prev.map((img) =>
        img.previewUrl === previewUrl ? {
          ...img,
          isUploading: false,
          uploadError: error instanceof Error ? error.message : t("uploadError")
        } : img
      ));

      toast({
        title: t("uploadErrorTitle"),
        description: t("uploadErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const addProductMutation = useMutation({
    mutationFn: async (data: AddProductFormData & { imageUrls: string[] }) => {
      const response = await fetch('/api/marketplace/items', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          price: Math.round(data.price * 100), // Convert to cents
        }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Failed to add product: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t("productAdded"),
        description: t("productAddedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/items"] });
      setLocation("/marketplace");
    },
    onError: (error) => {
      toast({
        title: t("error"),
        description: t("productAddFailed"),
        variant: "destructive",
      });
      console.error("Error adding product:", error);
    },
  });

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 images total
    const currentImageCount = uploadedImages.length;
    const availableSlots = 5 - currentImageCount;
    const filesToAdd = files.slice(0, availableSlots);

    // Add files to state with preview URLs
    const newImages: UploadedImage[] = filesToAdd.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      isUploading: false,
      uploadError: undefined,
    }));

    setUploadedImages(prev => [...prev, ...newImages]);

    // Start uploading each image
    for (const image of newImages) {
      uploadImage(image.file, image.previewUrl);
    }

    // Reset the input so removing a photo and re-picking the same file
    // fires onChange again
    event.target.value = "";
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      const imageToRemove = prev[index];
      // Revoke the preview URL to free memory
      URL.revokeObjectURL(imageToRemove.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const retryUpload = (index: number) => {
    const image = uploadedImages[index];
    if (image && !image.isUploading) {
      uploadImage(image.file, image.previewUrl);
    }
  };

  const onSubmit = async (data: AddProductFormData) => {
    if (uploadedImages.length === 0) {
      toast({
        title: t("imagesRequired"),
        description: t("imagesRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    // Check if all images have been uploaded successfully
    const uploadsInProgress = uploadedImages.some(img => img.isUploading);
    const failedUploads = uploadedImages.some(img => img.uploadError);
    const successfulUploads = uploadedImages.filter(img => img.uploadUrl);

    if (uploadsInProgress) {
      toast({
        title: t("uploadInProgress"),
        description: t("uploadInProgressDescription"),
        variant: "destructive",
      });
      return;
    }

    if (failedUploads || successfulUploads.length === 0) {
      toast({
        title: t("imagesError"),
        description: t("imagesErrorDescription"),
        variant: "destructive",
      });
      return;
    }

    // Use the uploaded image URLs
    const imageUrls = successfulUploads.map(img => img.uploadUrl!);
    
    addProductMutation.mutate({
      ...data,
      imageUrls,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <AppHeader title={t("addProduct")} backTo="/marketplace" right={null} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-5">

          {/* Photo Upload */}
          <section className="space-y-2.5">
            <h2 className="section-label">{t("productPhotosLabel")}</h2>
            <div className="card-float p-5">
              <p className="mb-4 text-sm leading-relaxed text-gray-600">
                {t("productPhotosHint")}
              </p>

              <div className="grid grid-cols-3 gap-2.5">
                {uploadedImages.map((image, index) => (
                  <div key={index} className="relative aspect-square overflow-hidden rounded-[20px] bg-gray-100">
                    <img
                      src={image.previewUrl}
                      alt={t("marketPhotoN").replace("{n}", String(index + 1))}
                      className="h-full w-full object-cover"
                    />

                    {/* Upload Status Overlay */}
                    {image.isUploading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gray-900/55 text-white">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-[11px] font-medium">{t("uploading")}</span>
                      </div>
                    )}

                    {/* Success Indicator */}
                    {image.uploadUrl && !image.isUploading && (
                      <div
                        className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-pink-500"
                        role="img"
                        aria-label={t("marketPhotoUploaded")}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                      </div>
                    )}

                    {/* Error Indicator */}
                    {image.uploadError && !image.isUploading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive p-2 text-center text-white">
                        <span className="text-[11px] font-medium leading-tight">{t("uploadError")}</span>
                        <button
                          type="button"
                          onClick={() => retryUpload(index)}
                          className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-900"
                        >
                          {t("retry")}
                        </button>
                      </div>
                    )}

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="glass absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-gray-900 disabled:opacity-50"
                      aria-label={t("marketRemovePhoto")}
                      disabled={image.isUploading}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {uploadedImages.length < 5 && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[20px] border-2 border-dashed border-gray-300 bg-white px-1 text-center text-gray-600">
                    <Camera className="h-6 w-6 text-pink-500" />
                    <span className="text-xs font-medium leading-tight">{t("addPhoto")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </section>

          {/* Basic Information */}
          <section className="space-y-2.5">
            <h2 className="section-label">{t("basicInfo")}</h2>
            <div className="card-float space-y-4 p-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("listingTitleRequired")}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t("listingTitlePlaceholder")}
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("categoryRequired")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder={t("selectCategory")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {optionLabel(t, category.value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("brandRequired")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-brand">
                          <SelectValue placeholder={t("selectBrand")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {brands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("sizeRequired")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-size">
                          <SelectValue placeholder={t("selectSize")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {optionLabel(t, size)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("conditionRequired")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-condition">
                          <SelectValue placeholder={t("selectCondition")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {conditions.map((condition) => (
                          <SelectItem key={condition.value} value={condition.value}>
                            {optionLabel(t, condition.value)}
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

          {/* Price and Location */}
          <section className="space-y-2.5">
            <h2 className="section-label">{t("priceAndLocation")}</h2>
            <div className="card-float space-y-4 p-5">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("priceRequired")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display font-semibold text-gray-900">€</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder={t("marketPricePlaceholder")}
                          className="pl-9"
                          value={priceText}
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          onChange={(e) => {
                            // Accept only digits with one comma/dot decimal separator
                            const raw = e.target.value.replace(/[^\d.,]/g, "");
                            setPriceText(raw);
                            const parsed = parseFloat(raw.replace(",", "."));
                            field.onChange(Number.isFinite(parsed) ? parsed : undefined);
                          }}
                          data-testid="input-price"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="negotiable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 space-y-0 rounded-2xl bg-gray-50 p-4">
                    <div className="space-y-1.5">
                      <FormLabel className="text-[15px] font-semibold">{t("negotiablePrice")}</FormLabel>
                      <p className="text-[13px] leading-snug text-gray-600">
                        {t("allowNegotiation")}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-negotiable"
                      />
                    </FormControl>
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

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className="block text-[13px] font-semibold text-gray-600">{t("descriptionRequired")}</FormLabel>
                <div className="card-float space-y-3 p-5">
                  <p className="text-sm leading-relaxed text-gray-600">
                    {t("productDescriptionHint")}
                  </p>
                  <FormControl>
                    <Textarea 
                      placeholder={t("productDescriptionPlaceholder")}
                      rows={4}
                      {...field}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {/* Optional Details */}
          <section className="space-y-2.5">
            <h2 className="section-label">{t("additionalDetailsOptional")}</h2>
            <div className="card-float space-y-4 p-5">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("colorLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectColor")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {colors.map((color) => (
                          <SelectItem key={color} value={color}>
                            {optionLabel(t, color)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="material"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("materialLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectMaterial")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {materials.map((material) => (
                          <SelectItem key={material} value={material}>
                            {optionLabel(t, material)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="season"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("seasonLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectSeason")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {seasons.map((season) => (
                          <SelectItem key={season.value} value={season.value}>
                            {optionLabel(t, season.value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="measurements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("specialMeasurements")}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t("measurementsPlaceholder")}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <p className="text-xs leading-relaxed text-gray-600">
                      {t("specialMeasurementsHint")}
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vintedUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("vintedLink")}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.vinted.it/..."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <p className="text-xs leading-relaxed text-gray-600">
                      {t("vintedLinkHint")}
                    </p>
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={addProductMutation.isPending}
              data-testid="button-submit"
            >
              {addProductMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t("publishing")}
                </>
              ) : (
                t("marketPublishListing")
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
