import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { insertServiceSchema, type InsertService } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

// Extended schema for the add service form
const addServiceSchema = insertServiceSchema.extend({
  // Ensure required fields
  title: z.string().min(1, "Il titolo del servizio è obbligatorio"),
  description: z.string().min(10, "La descrizione deve avere almeno 10 caratteri"),
  serviceType: z.string().min(1, "Seleziona un tipo di servizio"),
  location: z.string().min(1, "La posizione è obbligatoria"),
  availability: z.string().min(1, "Indica la tua disponibilità"),
  ageGroups: z.string().min(1, "Indica le fasce d'età con cui lavori"),
  hourlyRate: z.number({ invalid_type_error: "Inserisci una tariffa valida" }).min(0, "Inserisci una tariffa valida").optional(),
}).omit({
  providerId: true, // Will be set by backend
  isAvailable: true, // Default value
});

type AddServiceFormData = z.infer<typeof addServiceSchema>;

const serviceTypes = [
  { value: "Babysitting", label: "Babysitting" },
  { value: "Tutoring", label: "Ripetizioni" },
  { value: "Cleaning", label: "Pulizie domestiche" },
  { value: "Pet Care", label: "Cura animali" },
  { value: "Meal Prep", label: "Preparazione pasti" },
  { value: "Transportation", label: "Trasporto" },
  { value: "Elderly Care", label: "Assistenza anziani" },
  { value: "Personal Training", label: "Personal training" },
  { value: "Music Lessons", label: "Lezioni di musica" },
  { value: "Language Tutoring", label: "Lezioni di lingua" },
  { value: "Other", label: "Altro" }
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

  const createServiceMutation = useMutation({
    mutationFn: async (data: AddServiceFormData) => {
      // Convert hourly rate to cents if provided
      const serviceData = {
        ...data,
        hourlyRate: data.hourlyRate ? Math.round(data.hourlyRate * 100) : undefined,
      };
      
      const response = await apiRequest("POST", "/api/services", serviceData);
      if (!response.ok) {
        throw new Error("Impossibile creare il servizio");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Servizio pubblicato!",
        description: "Il tuo servizio è stato pubblicato con successo.",
      });
      setLocation("/marketplace");
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile creare il servizio",
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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/marketplace")}
            className="mr-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Aggiungi Servizio</h1>
            <p className="text-gray-600">Condividi le tue competenze con le altre mamme</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
              <CardContent className="p-6 space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Informazioni di base</h3>
                  
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titolo del servizio *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="es. Babysitter esperta disponibile nei weekend"
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
                        <FormLabel>Descrizione *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descrivi il tuo servizio, la tua esperienza e cosa ti rende speciale..."
                            className="min-h-[120px]"
                            {...field}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="serviceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo di servizio *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-service-type">
                                <SelectValue placeholder="Seleziona tipo di servizio" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {serviceTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
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
                      name="hourlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tariffa oraria (€)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="es. 15,00"
                                className="pl-8"
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
                  </div>

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posizione *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="es. Milano, Roma, Bologna..."
                            {...field}
                            data-testid="input-location"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Availability & Experience */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Disponibilità ed esperienza</h3>
                  
                  <FormField
                    control={form.control}
                    name="availability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disponibilità *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="es. Sere feriali 18-22, weekend mattina, orari flessibili..."
                            className="min-h-[80px]"
                            {...field}
                            data-testid="textarea-availability"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="experience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Anni di esperienza</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="es. 5 anni"
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
                          <FormLabel>Certificazioni</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="es. Primo soccorso, laurea in scienze dell'educazione"
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
                </div>

                {/* Age Groups */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Fasce d'età con cui lavori *</h3>
                  
                  <div className="space-y-3">
                    <Label>Seleziona le fasce d'età (almeno una):</Label>
                    <div className="flex flex-wrap gap-2">
                      {ageGroupOptions.map((ageGroup) => (
                        <Button
                          key={ageGroup}
                          type="button"
                          variant={selectedAgeGroups.includes(ageGroup) ? "default" : "outline"}
                          size="sm"
                          onClick={() => selectedAgeGroups.includes(ageGroup) ? removeAgeGroup(ageGroup) : addAgeGroup(ageGroup)}
                          className={selectedAgeGroups.includes(ageGroup) ? "bg-pink-600 hover:bg-pink-700" : ""}
                          data-testid={`button-age-${ageGroup.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          {selectedAgeGroups.includes(ageGroup) && <X className="h-3 w-3 mr-1" />}
                          {ageGroup}
                        </Button>
                      ))}
                    </div>
                    
                    {selectedAgeGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedAgeGroups.map((ageGroup) => (
                          <Badge key={ageGroup} variant="secondary" className="text-xs">
                            {ageGroup}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="ageGroups"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            type="hidden"
                            data-testid="input-age-groups-hidden"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {form.formState.errors.ageGroups && selectedAgeGroups.length === 0 && (
                    <p className="text-sm font-medium text-destructive mt-2">
                      Seleziona almeno una fascia d'età con cui lavori.
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/marketplace")}
                    className="flex-1"
                    data-testid="button-cancel"
                  >
                    Annulla
                  </Button>
                  <Button
                    type="submit"
                    disabled={createServiceMutation.isPending}
                    className="flex-1 bg-pink-600 hover:bg-pink-700"
                    data-testid="button-create-service"
                  >
                    {createServiceMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Pubblicazione...
                      </>
                    ) : (
                      'Pubblica Servizio'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
}