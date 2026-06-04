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
  title: z.string().min(1, "Service title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  serviceType: z.string().min(1, "Please select a service type"),
  location: z.string().min(1, "Location is required"),
  availability: z.string().min(1, "Please specify your availability"),
  ageGroups: z.string().min(1, "Please specify age groups you work with"),
  hourlyRate: z.number().min(0, "Hourly rate must be 0 or greater").optional(),
}).omit({
  providerId: true, // Will be set by backend
  isAvailable: true, // Default value
});

type AddServiceFormData = z.infer<typeof addServiceSchema>;

const serviceTypes = [
  { value: "Babysitting", label: "Babysitting" },
  { value: "Tutoring", label: "Tutoring" },
  { value: "Cleaning", label: "House Cleaning" },
  { value: "Pet Care", label: "Pet Care" },
  { value: "Meal Prep", label: "Meal Preparation" },
  { value: "Transportation", label: "Transportation" },
  { value: "Elderly Care", label: "Elderly Care" },
  { value: "Personal Training", label: "Personal Training" },
  { value: "Music Lessons", label: "Music Lessons" },
  { value: "Language Tutoring", label: "Language Tutoring" },
  { value: "Other", label: "Other" }
];

const ageGroupOptions = [
  "0-2 years",
  "3-5 years", 
  "6-12 years",
  "13+ years",
  "Adults",
  "All ages"
];

export default function AddService() {
  const [, setLocation] = useLocation();
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
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
        throw new Error("Failed to create service");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Service Created!",
        description: "Your service has been successfully posted.",
      });
      setLocation("/marketplace");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create service",
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
            <h1 className="text-2xl font-bold text-gray-900">Add New Service</h1>
            <p className="text-gray-600">Share your skills with other mothers</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
              <CardContent className="p-6 space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Title *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Experienced babysitter available weekends"
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
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your service, experience, and what makes you special..."
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
                          <FormLabel>Service Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-service-type">
                                <SelectValue placeholder="Select service type" />
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
                          <FormLabel>Hourly Rate (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="e.g., 15.00"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              data-testid="input-hourly-rate"
                            />
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
                        <FormLabel>Location *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Milan, Barcelona, etc."
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability & Experience</h3>
                  
                  <FormField
                    control={form.control}
                    name="availability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Availability *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Weekday evenings 6-10pm, weekend mornings, flexible schedule..."
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
                          <FormLabel>Years of Experience</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 5 years"
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
                          <FormLabel>Certifications</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., First Aid, CPR, Teaching degree"
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Age Groups You Work With *</h3>
                  
                  <div className="space-y-3">
                    <Label>Select age groups (choose at least one):</Label>
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
                      Please select at least one age group you work with.
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
                    Cancel
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
                        Creating...
                      </>
                    ) : (
                      'Create Service'
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