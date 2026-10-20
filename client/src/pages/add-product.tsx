import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Upload, X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { insertMarketplaceItemSchema, type InsertMarketplaceItem } from "@shared/schema";
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center p-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full mr-3"
            onClick={() => setLocation("/marketplace")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <h1 className="text-xl font-semibold text-gray-900 flex-1">{t("addProduct")}</h1>
        </div>
      </header>

      {/* Form */}
      <div className="p-4 pb-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Photo Upload */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-base font-semibold text-gray-900 mb-3 block">
                  {t("productPhotosLabel")}
                </Label>
                <p className="text-sm text-gray-600 mb-4">
                  {t("productPhotosHint")}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={image.previewUrl}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      
                      {/* Upload Status Overlay */}
                      {image.isUploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                          <div className="text-white text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <span className="text-xs">{t("uploading")}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Success Indicator */}
                      {image.uploadUrl && !image.isUploading && (
                        <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                          <svg className="h-4 w-4" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                      )}
                      
                      {/* Error Indicator */}
                      {image.uploadError && !image.isUploading && (
                        <div className="absolute inset-0 bg-red-500 bg-opacity-90 rounded-lg flex items-center justify-center">
                          <div className="text-white text-center p-2">
                            <X className="h-6 w-6 mx-auto mb-2" />
                            <span className="text-xs">{t("uploadError")}</span>
                            <button
                              type="button"
                              onClick={() => retryUpload(index)}
                              className="block mx-auto mt-2 text-xs underline hover:no-underline"
                            >
                              {t("retry")}
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        disabled={image.isUploading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  
                  {uploadedImages.length < 5 && (
                    <label className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">{t("addPhoto")}</span>
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
              </CardContent>
            </Card>

            {/* Basic Information */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="text-base font-semibold text-gray-900">{t("basicInfo")}</h3>

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
              </CardContent>
            </Card>

            {/* Price and Location */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="text-base font-semibold text-gray-900">{t("priceAndLocation")}</h3>

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("priceRequired")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="es. 12,50"
                            className="pl-8"
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
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">{t("negotiablePrice")}</FormLabel>
                        <p className="text-sm text-gray-500">
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
                      <FormLabel>{t("locationRequired")}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t("cityPlaceholder")}
                          {...field}
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardContent className="p-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("descriptionRequired")}</FormLabel>
                      <p className="text-sm text-gray-500 mb-2">
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
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Optional Details */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="text-base font-semibold text-gray-900">{t("additionalDetailsOptional")}</h3>

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
                      <p className="text-xs text-gray-500">
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
                      <p className="text-xs text-gray-500">
                        {t("vintedLinkHint")}
                      </p>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                style={{ 
                  background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                }}
                disabled={addProductMutation.isPending}
                data-testid="button-submit"
              >
                {addProductMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t("publishing")}
                  </div>
                ) : (
                  "Pubblica Prodotto"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}