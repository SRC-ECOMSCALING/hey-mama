import { useState } from "react";
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

// Extended schema for the add product form
const addProductSchema = insertMarketplaceItemSchema.extend({
  // Ensure required fields
  title: z.string().min(1, "Il titolo è obbligatorio"),
  description: z.string().min(10, "La descrizione deve essere almeno 10 caratteri"),
  price: z.number().min(1, "Il prezzo deve essere maggiore di 0"),
  category: z.string().min(1, "Seleziona una categoria"),
  brand: z.string().min(1, "Seleziona una marca"),
  size: z.string().min(1, "Seleziona una taglia"),
  condition: z.string().min(1, "Seleziona una condizione"),
  location: z.string().min(1, "La posizione è obbligatoria"),
}).omit({
  sellerId: true, // Will be set by backend
  isAvailable: true, // Default value
  ageRange: true, // Not used for clothing
});

type AddProductFormData = z.infer<typeof addProductSchema>;

const categories = [
  { value: "Abbigliamento > Neonati 0-12 mesi", label: "Abbigliamento Neonati 0-12 mesi" },
  { value: "Abbigliamento > Bambini 1-5 anni", label: "Abbigliamento Bambini 1-5 anni" },
  { value: "Calzature > Primi passi", label: "Scarpine primi passi" },
  { value: "Calzature > Bambino", label: "Scarpe bambino" },
  { value: "Passeggini e Viaggi > Passeggini", label: "Passeggini" },
  { value: "Passeggini e Viaggi > Seggiolini auto", label: "Seggiolini auto" },
  { value: "Passeggini e Viaggi > Zaini porta bebè", label: "Zaini porta bebè" },
  { value: "Alimentazione > Biberon", label: "Biberon e accessori" },
  { value: "Alimentazione > Seggioloni", label: "Seggioloni" },
  { value: "Alimentazione > Sterilizzatori", label: "Sterilizzatori" },
  { value: "Giochi e Libri > Peluche", label: "Peluche" },
  { value: "Giochi e Libri > Giochi educativi", label: "Giochi educativi" },
  { value: "Giochi e Libri > Libri per bambini", label: "Libri per bambini" },
  { value: "Cameretta > Lettini", label: "Lettini" },
  { value: "Cameretta > Fasciatoi", label: "Fasciatoi" },
  { value: "Cameretta > Decorazioni", label: "Decorazioni cameretta" },
  { value: "Cura e Igiene > Pannolini", label: "Pannolini" },
  { value: "Cura e Igiene > Bagnetto", label: "Prodotti bagnetto" },
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
  { value: "new-with-tags", label: "Nuovo con etichette" },
  { value: "new-without-tags", label: "Nuovo senza etichette" },
  { value: "excellent", label: "Ottimo" },
  { value: "good", label: "Buono" },
  { value: "fair", label: "Discreto" },
  { value: "damaged", label: "Danneggiato" }
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
  { value: "Estivo", label: "Estivo" },
  { value: "Invernale", label: "Invernale" },
  { value: "Tutto l'anno", label: "Tutto l'anno" }
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddProductFormData>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
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

  // Function to get upload URL from backend
  const getUploadUrl = async (): Promise<string> => {
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to get upload URL');
    }
    
    const data = await response.json();
    return data.uploadURL;
  };

  // Function to upload file to cloud storage
  const uploadFileToStorage = async (file: File, uploadUrl: string): Promise<string> => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload file');
    }
    
    // Return the object URL (clean object path without bucket or .private prefix)
    const url = new URL(uploadUrl);
    let pathname = url.pathname;
    
    // Remove leading slash
    if (pathname.startsWith('/')) {
      pathname = pathname.slice(1);
    }
    
    // Split into parts and remove bucket and .private segments
    const parts = pathname.split('/');
    let cleanParts = parts;
    
    // Remove bucket name (first segment) if present
    if (cleanParts.length > 0) {
      cleanParts = cleanParts.slice(1);
    }
    
    // Remove .private segment if present
    if (cleanParts.length > 0 && cleanParts[0] === '.private') {
      cleanParts = cleanParts.slice(1);
    }
    
    const objectPath = cleanParts.join('/');
    return `/objects/${objectPath}`;
  };

  // Function to upload a single image
  const uploadImage = async (file: File, index: number) => {
    try {
      // Mark as uploading
      setUploadedImages(prev => prev.map((img, i) => 
        i === index ? { ...img, isUploading: true, uploadError: undefined } : img
      ));

      // Get upload URL and upload file
      const uploadUrl = await getUploadUrl();
      const objectUrl = await uploadFileToStorage(file, uploadUrl);

      // Mark as completed
      setUploadedImages(prev => prev.map((img, i) => 
        i === index ? { ...img, uploadUrl: objectUrl, isUploading: false } : img
      ));

    } catch (error) {
      console.error('Upload error:', error);
      
      // Mark as failed
      setUploadedImages(prev => prev.map((img, i) => 
        i === index ? { 
          ...img, 
          isUploading: false, 
          uploadError: error instanceof Error ? error.message : 'Upload failed' 
        } : img
      ));

      toast({
        title: "Errore di caricamento",
        description: "Impossibile caricare l'immagine. Riprova.",
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
        title: "Prodotto aggiunto!",
        description: "Il tuo prodotto per bambini è stato pubblicato con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/items"] });
      setLocation("/marketplace");
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: "Non è stato possibile pubblicare il prodotto. Riprova.",
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
    const startIndex = currentImageCount;
    for (let i = 0; i < newImages.length; i++) {
      uploadImage(filesToAdd[i], startIndex + i);
    }
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
      uploadImage(image.file, index);
    }
  };

  const onSubmit = async (data: AddProductFormData) => {
    if (uploadedImages.length === 0) {
      toast({
        title: "Immagini richieste",
        description: "Aggiungi almeno una foto del prodotto.",
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
        title: "Caricamento in corso",
        description: "Attendi che tutte le immagini vengano caricate.",
        variant: "destructive",
      });
      return;
    }

    if (failedUploads || successfulUploads.length === 0) {
      toast({
        title: "Errore nelle immagini",
        description: "Alcune immagini non sono state caricate. Riprova o rimuovile.",
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
          <h1 className="text-xl font-semibold text-gray-900 flex-1">Aggiungi Prodotto</h1>
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
                  Foto del prodotto per bambini *
                </Label>
                <p className="text-sm text-gray-600 mb-4">
                  Aggiungi almeno 1 foto (meglio 3-5). Usa foto chiare e ben illuminate del prodotto per bambini.
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
                            <span className="text-xs">Caricamento...</span>
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
                            <span className="text-xs">Errore caricamento</span>
                            <button
                              type="button"
                              onClick={() => retryUpload(index)}
                              className="block mx-auto mt-2 text-xs underline hover:no-underline"
                            >
                              Riprova
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
                      <span className="text-sm text-gray-500">Aggiungi foto</span>
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
                <h3 className="text-base font-semibold text-gray-900">Informazioni di base</h3>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titolo dell'annuncio *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="es. Tutina Chicco in cotone taglia 3 mesi"
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
                      <FormLabel>Categoria *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Seleziona categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
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
                      <FormLabel>Marca *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-brand">
                            <SelectValue placeholder="Seleziona marca" />
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
                      <FormLabel>Taglia *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-size">
                            <SelectValue placeholder="Seleziona taglia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sizes.map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
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
                      <FormLabel>Condizione *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-condition">
                            <SelectValue placeholder="Seleziona condizione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {conditions.map((condition) => (
                            <SelectItem key={condition.value} value={condition.value}>
                              {condition.label}
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
                <h3 className="text-base font-semibold text-gray-900">Prezzo e posizione</h3>

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prezzo (€) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          data-testid="input-price"
                        />
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
                        <FormLabel className="text-base">Prezzo trattabile</FormLabel>
                        <p className="text-sm text-gray-500">
                          Permetti agli acquirenti di negoziare il prezzo
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
                      <FormLabel>Posizione *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="es. Milano, Roma, Napoli"
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
                      <FormLabel>Descrizione *</FormLabel>
                      <p className="text-sm text-gray-500 mb-2">
                        Descrivi materiali, vestibilità, eventuali difetti o modifiche
                      </p>
                      <FormControl>
                        <Textarea 
                          placeholder="Descrivi materiali, età consigliata, eventuali difetti o segni di usura..."
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
                <h3 className="text-base font-semibold text-gray-900">Dettagli aggiuntivi (opzionale)</h3>

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colore</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona colore" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {colors.map((color) => (
                            <SelectItem key={color} value={color}>
                              {color}
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
                      <FormLabel>Materiale</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona materiale" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {materials.map((material) => (
                            <SelectItem key={material} value={material}>
                              {material}
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
                      <FormLabel>Stagione</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona stagione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {seasons.map((season) => (
                            <SelectItem key={season.value} value={season.value}>
                              {season.label}
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
                      <FormLabel>Misure speciali</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="es. Lunghezza 80cm, larghezza spalle 40cm"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500">
                        Solo se non sono misure standard
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vintedUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link Vinted</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://www.vinted.it/..."
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500">
                        Se lo stesso articolo è anche su Vinted
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
                    Pubblicazione...
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