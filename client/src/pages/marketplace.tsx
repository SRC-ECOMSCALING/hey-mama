import { useState } from "react";
import { getMarketPrefs, setMarketPrefs, type MarketPrefs } from "@/lib/marketPrefs";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Heart, Search, Filter, Euro, MapPin, ExternalLink, Plus, Clock, ChevronLeft, ChevronRight, X, Edit, Trash2, Loader2, Info, SlidersHorizontal, ShoppingBag, Wrench, Tag, HandCoins } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navigation from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MarketplaceItem, LookingForPost, Service, ServiceLookingForPost, Profile } from "@shared/schema";
import { insertMarketplaceItemSchema } from "@shared/schema";
import { z } from "zod";
import UserInfoModal from "@/components/user-info-modal";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/lib/translations";

// Category keys for translation
const categoryKeys = [
  "categoryAll",
  "categoryStrollersTravel",
  "categoryToysGames",
  "categoryClothing",
  "categoryFeedingHighchairs",
  "categoryBooksLearning",
  "categorySafetyHealth",
  "categoryFurnitureDecor"
] as const;

const conditions = [
  { value: "new-with-tags", label: "Nuovo con etichette", color: "bg-green-100 text-green-800" },
  { value: "new-without-tags", label: "Nuovo senza etichette", color: "bg-green-100 text-green-800" },
  { value: "excellent", label: "Ottimo", color: "bg-blue-100 text-blue-800" },
  { value: "good", label: "Buono", color: "bg-blue-100 text-blue-800" },
  { value: "fair", label: "Discreto", color: "bg-yellow-100 text-yellow-800" },
  { value: "damaged", label: "Danneggiato", color: "bg-red-100 text-red-800" }
];

// Edit form schema
const editProductSchema = insertMarketplaceItemSchema.pick({
  title: true,
  description: true,
  price: true,
  condition: true,
  negotiable: true,
}).extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().min(1, "Price must be greater than 0"),
});

type EditProductFormData = z.infer<typeof editProductSchema>;

type MarketplaceItemWithSeller = MarketplaceItem & { sellerProfile?: Profile | null };

const urgencyColors = {
  urgent: "bg-red-100 text-red-800 border-red-300",
  normal: "bg-blue-100 text-blue-800 border-blue-300",
  flexible: "bg-green-100 text-green-800 border-green-300",
};

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("categoryAll");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [editingItem, setEditingItem] = useState<MarketplaceItem | null>(null);
  const [showChoiceDialog, setShowChoiceDialog] = useState(false);
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<Profile | null>(null);

  // Marketplace onboarding preferences: when missing (first access), a setup
  // screen asks for city / interest / buy-or-sell, then opens the right view.
  const [prefs, setPrefs] = useState<MarketPrefs | null>(() => getMarketPrefs());
  const [showSetup, setShowSetup] = useState(() => getMarketPrefs() === null);
  const [draftCity, setDraftCity] = useState(() => getMarketPrefs()?.city ?? "");
  const [draftInterest, setDraftInterest] = useState<"items" | "services" | null>(() => getMarketPrefs()?.interest ?? null);
  const [draftMode, setDraftMode] = useState<"buy" | "sell" | null>(() => getMarketPrefs()?.mode ?? null);
  const [mainTab, setMainTab] = useState<string>(() => (getMarketPrefs()?.interest === "services" ? "services" : "marketplace"));
  const [marketSubTab, setMarketSubTab] = useState<string>(() => (getMarketPrefs()?.mode === "sell" ? "my-products" : "items"));

  const applyPrefs = (next: MarketPrefs) => {
    setMarketPrefs(next);
    setPrefs(next);
    setMainTab(next.interest === "services" ? "services" : "marketplace");
    setMarketSubTab(next.mode === "sell" ? "my-products" : "items");
    setShowSetup(false);
  };

  const clearCityFilter = () => {
    if (prefs) applyPrefs({ ...prefs, city: "" });
  };
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Edit form
  const editForm = useForm<EditProductFormData>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      condition: "good",
      negotiable: false,
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string; updates: EditProductFormData }) => {
      const response = await fetch(`/api/marketplace/items/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...data.updates,
          price: Math.round(data.updates.price * 100), // Convert to cents
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/items'] });
      toast({
        title: t("productUpdated"),
        description: t("productUpdatedSuccess"),
      });
      setEditingItem(null);
      editForm.reset();
    },
    onError: (error) => {
      toast({
        title: t("error"),
        description: t("errorUpdatingProduct"),
        variant: "destructive",
      });
      console.error('Error updating product:', error);
    },
  });

  // Handle edit item
  const handleEditItem = (item: MarketplaceItem) => {
    setEditingItem(item);
    editForm.reset({
      title: item.title,
      description: item.description,
      price: item.price / 100, // Convert from cents
      condition: item.condition,
      negotiable: item.negotiable || false,
    });
  };

  // Handle edit form submission
  const handleEditSubmit = (data: EditProductFormData) => {
    if (editingItem) {
      updateProductMutation.mutate({ id: editingItem.id, updates: data });
    }
  };

  const { data: items = [], isLoading } = useQuery<MarketplaceItemWithSeller[]>({
    queryKey: ["/api/marketplace/items", selectedCategory === "categoryAll" ? undefined : t(selectedCategory as keyof (typeof translations)["it"])],
  });

  // Saved items queries and mutations
  const { data: savedItems = [] } = useQuery<MarketplaceItem[]>({
    queryKey: ["/api/marketplace/saved-items"],
    enabled: !!user,
  });

  const saveItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest('POST', '/api/marketplace/saved-items', { itemId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/saved-items"] });
      toast({
        title: t("itemSaved"),
        description: t("addedToSaved"),
      });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("errorSavingItem"),
        variant: "destructive",
      });
    },
  });

  const unsaveItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest('DELETE', `/api/marketplace/saved-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/saved-items"] });
      toast({
        title: t("itemRemoved"),
        description: t("removedFromSaved"),
      });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("errorSavingItem"),
        variant: "destructive",
      });
    },
  });

  const { data: lookingForPosts = [], isLoading: isLoadingLookingFor } = useQuery<LookingForPost[]>({
    queryKey: ["/api/marketplace/looking-for", selectedCategory === "categoryAll" ? undefined : t(selectedCategory as keyof (typeof translations)["it"])],
  });

  const { data: services = [], isLoading: isLoadingServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: serviceLookingForPosts = [], isLoading: isLoadingServiceLookingFor } = useQuery<ServiceLookingForPost[]>({
    queryKey: ["/api/services/looking-for"],
  });

  const cityFilter = prefs?.city.trim().toLowerCase() ?? "";
  const filteredItems = items
    .filter(item =>
      (item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
      item.sellerId !== user?.id &&
      (!cityFilter || (item.location || "").toLowerCase().includes(cityFilter))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "price-low": return a.price - b.price;
        case "price-high": return b.price - a.price;
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  // Filter user's own items
  const userItems = items.filter(item => item.sellerId === user?.id);
  
  // Filter user's services
  const userServices = services.filter(service => service.providerId === user?.id);
  
  // Filter user's service requests
  const userServiceRequests = serviceLookingForPosts.filter(post => post.userId === user?.id);

  // Saved items are already loaded from the database
  const savedItemsList = savedItems;

  const formatPrice = (priceInCents: number) => {
    return `€${(priceInCents / 100).toFixed(0)}`;
  };

  const getConditionStyle = (condition: string) => {
    return conditions.find(c => c.value === condition)?.color || "bg-gray-100 text-gray-800";
  };

  const toggleSaved = (itemId: string) => {
    if (isItemSaved(itemId)) {
      unsaveItemMutation.mutate(itemId);
    } else {
      saveItemMutation.mutate(itemId);
    }
  };

  // Check if an item is saved
  const isItemSaved = (itemId: string) => {
    return savedItems.some(item => item.id === itemId);
  };

  // Delete item functionality
  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm(t("deleteConfirm"))) {
      try {
        const response = await fetch(`/api/marketplace/items/${itemId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to delete item');
        }
        queryClient.invalidateQueries({ queryKey: ["/api/marketplace/items"] });
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item. Please try again.');
      }
    }
  };



  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white bg-black">
        <div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const getTimeSince = (dateString: string | Date) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) return t("justNow");
    if (diffHours < 24) return `${diffHours}${t("hoursAgo")}`;
    if (diffDays === 1) return t("yesterday");
    return `${diffDays} ${t("daysAgo")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* First-access setup: choose city / interest / buy-or-sell */}
      {showSetup && (
        <div className="fixed inset-0 z-[60] bg-gradient-to-br from-pink-50 via-white to-purple-50 overflow-y-auto safe-top">
          <div className="max-w-md mx-auto px-6 py-10 pb-16">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}>
                <ShoppingBag className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Benvenuta nel Market!</h2>
              <p className="text-sm text-gray-500">
                Dicci cosa cerchi e ti mostriamo subito la pagina giusta. Potrai cambiare queste preferenze quando vuoi.
              </p>
            </div>

            {/* Posizione */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-900 mb-2">📍 Dove ti trovi?</p>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Città (opzionale, es. Novara)"
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
                  className="pl-11 h-12 rounded-2xl bg-white border-gray-200"
                  data-testid="input-setup-city"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Vedrai prima gli annunci della tua zona. Lascia vuoto per tutte le città.</p>
            </div>

            {/* Interesse */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-900 mb-2">Cosa ti interessa?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDraftInterest("items")}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    draftInterest === "items" ? "border-pink-400 bg-pink-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  data-testid="setup-interest-items"
                >
                  <Tag className={`w-6 h-6 mb-2 ${draftInterest === "items" ? "text-pink-500" : "text-gray-400"}`} />
                  <p className="font-semibold text-sm text-gray-900">Oggetti</p>
                  <p className="text-xs text-gray-500">Passeggini, vestiti, giochi…</p>
                </button>
                <button
                  onClick={() => setDraftInterest("services")}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    draftInterest === "services" ? "border-pink-400 bg-pink-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  data-testid="setup-interest-services"
                >
                  <Wrench className={`w-6 h-6 mb-2 ${draftInterest === "services" ? "text-pink-500" : "text-gray-400"}`} />
                  <p className="font-semibold text-sm text-gray-900">Servizi</p>
                  <p className="text-xs text-gray-500">Babysitting, ripetizioni…</p>
                </button>
              </div>
            </div>

            {/* Compra o vendi */}
            <div className="mb-8">
              <p className="text-sm font-semibold text-gray-900 mb-2">Vuoi comprare o vendere?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDraftMode("buy")}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    draftMode === "buy" ? "border-pink-400 bg-pink-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  data-testid="setup-mode-buy"
                >
                  <ShoppingBag className={`w-6 h-6 mb-2 ${draftMode === "buy" ? "text-pink-500" : "text-gray-400"}`} />
                  <p className="font-semibold text-sm text-gray-900">Comprare</p>
                  <p className="text-xs text-gray-500">Sfoglia gli annunci</p>
                </button>
                <button
                  onClick={() => setDraftMode("sell")}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    draftMode === "sell" ? "border-pink-400 bg-pink-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  data-testid="setup-mode-sell"
                >
                  <HandCoins className={`w-6 h-6 mb-2 ${draftMode === "sell" ? "text-pink-500" : "text-gray-400"}`} />
                  <p className="font-semibold text-sm text-gray-900">Vendere</p>
                  <p className="text-xs text-gray-500">Gestisci i tuoi annunci</p>
                </button>
              </div>
            </div>

            <Button
              className="w-full h-12 rounded-2xl text-base font-semibold text-white"
              style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
              disabled={!draftInterest || !draftMode}
              onClick={() =>
                draftInterest && draftMode &&
                applyPrefs({ city: draftCity.trim(), interest: draftInterest, mode: draftMode })
              }
              data-testid="button-setup-start"
            >
              Inizia 🎉
            </Button>
            {prefs && (
              <Button
                variant="ghost"
                className="w-full mt-2 text-gray-500"
                onClick={() => setShowSetup(false)}
                data-testid="button-setup-cancel"
              >
                Annulla
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 safe-top">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3 pr-14">
            <h1 className="text-2xl font-bold text-gray-900 flex-1">{t("marketplace")}</h1>
            {prefs?.city && (
              <button
                onClick={clearCityFilter}
                className="flex items-center gap-1 text-xs font-medium bg-pink-50 text-pink-600 rounded-full pl-2.5 pr-1.5 py-1.5 hover:bg-pink-100 transition-colors"
                title="Rimuovi filtro città"
                data-testid="chip-city-filter"
              >
                <MapPin className="h-3 w-3" />
                {prefs.city}
                <X className="h-3 w-3 ml-0.5" />
              </button>
            )}
            <button
              onClick={() => {
                setDraftCity(prefs?.city ?? "");
                setDraftInterest(prefs?.interest ?? null);
                setDraftMode(prefs?.mode ?? null);
                setShowSetup(true);
              }}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              title="Preferenze marketplace"
              data-testid="button-market-prefs"
            >
              <SlidersHorizontal className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t("searchItems")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-11 rounded-full bg-gray-100 border-0 text-gray-900 placeholder-gray-400 focus-visible:ring-pink-300"
              data-testid="input-market-search"
            />
          </div>

          {/* Category chips + sort */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categoryKeys.map(categoryKey => {
              const active = selectedCategory === categoryKey;
              return (
                <button
                  key={categoryKey}
                  onClick={() => setSelectedCategory(categoryKey)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  style={active ? { background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" } : undefined}
                  data-testid={`chip-category-${categoryKey}`}
                >
                  {t(categoryKey)}
                </button>
              );
            })}
            <div className="shrink-0">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-[30px] rounded-full bg-gray-100 border-0 text-xs text-gray-600 px-3.5 w-auto gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("newest")}</SelectItem>
                  <SelectItem value="oldest">{t("oldest")}</SelectItem>
                  <SelectItem value="price-low">{t("priceLowest")}</SelectItem>
                  <SelectItem value="price-high">{t("priceHighest")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="p-4">
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 h-11 rounded-full bg-gray-100 p-1">
            <TabsTrigger value="marketplace" className="rounded-full">{t("marketplace")}</TabsTrigger>
            <TabsTrigger value="services" className="rounded-full">{t("services")}</TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace" className="mt-0">
            <Tabs value={marketSubTab} onValueChange={setMarketSubTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-10 rounded-full bg-gray-100 p-1">
                <TabsTrigger value="items" className="rounded-full">{t("forSale")}</TabsTrigger>
                <TabsTrigger value="my-products" className="rounded-full">{t("myProducts")}</TabsTrigger>
              </TabsList>

              <TabsContent value="items" className="mt-0">
            {filteredItems.length === 0 ? (
              <div className="text-center py-14 px-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-50 flex items-center justify-center">
                  <ShoppingBag className="w-7 h-7 text-pink-400" />
                </div>
                <div className="text-gray-700 font-semibold mb-1">{t("noItemsFound")}</div>
                <div className="text-gray-500 text-sm mb-4">
                  {cityFilter
                    ? `Nessun articolo a "${prefs?.city}". Prova ad allargare la ricerca.`
                    : t("tryDifferentCategory")}
                </div>
                {cityFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={clearCityFilter}
                    data-testid="button-clear-city-empty"
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" />
                    Mostra tutte le città
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4 mb-nav">
                {filteredItems.map((item) => (
              <Card key={item.id} className="bg-white rounded-2xl border-0 shadow-sm overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => {
                setSelectedItem(item);
                setSelectedImageIndex(0);
              }} data-testid={`card-product-${item.id}`}>
                <div className="flex">
                  {/* Image Section */}
                  <div className="relative w-24 sm:w-32 h-24 sm:h-32 flex-shrink-0 flex items-center justify-center p-2">
                    {item.imageUrls && item.imageUrls.length > 0 ? (
                      <img
                        src={item.imageUrls[0]}
                        alt={item.title}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21,15 16,10 5,21"/%3E%3C/svg%3E';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                        <div className="text-gray-400 text-xs text-center">
                          <div className="w-8 h-8 mx-auto mb-1 opacity-50">
                            📷
                          </div>
                          No Image
                        </div>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaved(item.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white transition-colors"
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          isItemSaved(item.id)
                            ? "fill-pink-500 text-pink-500"
                            : "text-gray-600"
                        }`}
                      />
                    </button>
                    <div className="absolute bottom-2 left-2">
                      <Badge className={getConditionStyle(item.condition)}>
                        {conditions.find(c => c.value === item.condition)?.label}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Content Section */}
                  <div className="flex-1 p-2 sm:p-4 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <span className="text-xs sm:text-sm text-gray-600 font-medium truncate">
                            {item.sellerProfile ? `${item.sellerProfile.firstName} ${item.sellerProfile.lastName}` : 'Unknown Seller'}
                          </span>
                          {item.sellerProfile && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.sellerProfile) {
                                  setSelectedUserProfile(item.sellerProfile);
                                  setShowUserInfoModal(true);
                                }
                              }}
                              className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
                              data-testid={`button-info-seller-${item.id}`}
                            >
                              <Info className="h-4 w-4" style={{ color: "#d91c5c" }} />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center font-bold text-lg sm:text-xl shrink-0" style={{ color: "#d91c5c" }}>
                          <Euro className="h-4 w-4 sm:h-5 sm:w-5 mr-0.5 sm:mr-1" />
                          {(item.price / 100).toFixed(0)}
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 text-base sm:text-lg leading-tight mb-1">
                        {item.title}
                      </h3>
                      
                      <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2">
                        {item.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 mb-2 sm:mb-4">
                        <div className="flex items-center min-w-0 flex-1">
                          <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                        <span className="shrink-0 ml-2">{getTimeSince(item.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="h-10 px-2 sm:px-3 bg-gray-200 rounded-lg flex items-center justify-center text-xs font-bold text-gray-700 border border-gray-300 border-gray-600 shrink-0">
                        {item.size || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                        {item.vintedUrl && (
                          <button
                            onClick={() => window.open(item.vintedUrl!, '_blank')}
                            className="w-10 h-10 bg-teal-500 hover:bg-teal-600 rounded-lg flex items-center justify-center transition-colors shrink-0"
                            title="View on Vinted"
                          >
                            <span className="text-white font-bold text-base">V</span>
                          </button>
                        )}
                        <Button
                          size="default"
                          className="text-white px-3 sm:px-6 h-10 rounded-lg text-xs sm:text-sm shrink-0"
                          style={{
                            background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/market-chat/${item.id}/${item.sellerId}`);
                          }}
                          data-testid={`button-message-seller-${item.id}`}
                        >
                          {t("message")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
                ))}
              </div>
            )}
              </TabsContent>

              <TabsContent value="my-products" className="mt-0">
            {userItems.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-2">{t("noProductsYet")}</div>
                <div className="text-gray-500 text-sm">{t("noProductsYet")}</div>
              </div>
            ) : (
              <div className="space-y-4 mb-nav">
                {userItems.map((item) => (
                  <Card key={item.id} className="bg-white rounded-2xl border-0 shadow-sm overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => {
                    setSelectedItem(item);
                    setSelectedImageIndex(0);
                  }} data-testid={`card-my-product-${item.id}`}>
                    <div className="flex">
                      {/* Image Section */}
                      <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center p-2">
                        {item.imageUrls && item.imageUrls.length > 0 ? (
                          <img
                            src={item.imageUrls[0]}
                            alt={item.title}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21,15 16,10 5,21"/%3E%3C/svg%3E';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                            <div className="text-gray-400 text-xs text-center">
                              <div className="w-8 h-8 mx-auto mb-1 opacity-50">
                                📷
                              </div>
                              No Image
                            </div>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white transition-colors"
                          data-testid={`button-edit-${item.id}`}
                        >
                          <Edit className="h-4 w-4 text-gray-600" />
                        </button>
                        <div className="absolute bottom-2 left-2">
                          <Badge className={getConditionStyle(item.condition)}>
                            {conditions.find(c => c.value === item.condition)?.label}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Content Section */}
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                              {item.title}
                            </h3>
                            <div className="flex items-center font-bold text-xl ml-4" style={{ color: "#d91c5c" }}>
                              <Euro className="h-5 w-5 mr-1" />
                              {(item.price / 100).toFixed(0)}
                            </div>
                          </div>
                          
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {item.description}
                          </p>
                          
                          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              {item.location}
                            </div>
                            <span>{getTimeSince(item.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="h-10 px-3 bg-gray-200 rounded-lg flex items-center justify-center text-xs font-bold text-gray-700 border border-gray-300">
                            {item.size || 'N/A'}
                          </div>
                          <div className="flex items-center gap-3">
                            {item.vintedUrl && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(item.vintedUrl!, '_blank');
                                }}
                                className="w-10 h-10 bg-teal-500 hover:bg-teal-600 rounded-lg flex items-center justify-center transition-colors"
                                title="View on Vinted"
                              >
                                <span className="text-white font-bold text-base">V</span>
                              </button>
                            )}
                            <Button 
                              size="default" 
                              className="text-white px-6 h-10 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(item);
                              }}
                              data-testid={`button-edit-product-main-${item.id}`}
                              style={{ 
                                background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t("edit")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="services" className="mt-0">
            <Tabs defaultValue="my-services" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-10 rounded-full bg-gray-100 p-1">
                <TabsTrigger value="my-services" className="rounded-full">{t("myServices")}</TabsTrigger>
                <TabsTrigger value="my-requests" className="rounded-full">{t("myRequests")}</TabsTrigger>
              </TabsList>

              <TabsContent value="my-services" className="mt-0">
                {userServices.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-2">{t("noServicesYet")}</div>
                    <div className="text-gray-500 text-sm">{t("clickAddService")}</div>
                  </div>
                ) : (
                  <div className="space-y-4 mb-nav">
                    {userServices.map((service) => (
                      <Card key={service.id} className="bg-white rounded-2xl border-0 shadow-sm overflow-hidden">
                        <div className="flex">
                          {/* Icon Section for Services */}
                          <div className="w-32 h-32 flex-shrink-0 flex items-center justify-center p-4 bg-blue-50">
                            <div className="text-center">
                              <div className="w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-2xl">🛠️</span>
                              </div>
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
                                {service.serviceType}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Content Section */}
                          <div className="flex-1 p-4 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between mb-1">
                                <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                                  {service.title}
                                </h3>
                                {service.hourlyRate && (
                                  <div className="flex items-center font-bold text-lg ml-4" style={{ color: "#d91c5c" }}>
                                    <Euro className="h-4 w-4 mr-1" />
                                    {(service.hourlyRate / 100).toFixed(0)}{t("perHour")}
                                  </div>
                                )}
                              </div>
                          
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center text-sm text-gray-500">
                                  <MapPin className="h-4 w-4 mr-1" />
                                  {service.location}
                                </div>
                              </div>
                              
                              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                                {service.description}
                              </p>
                              
                              {service.experience && (
                                <div className="flex items-center text-xs text-gray-500 mb-2">
                                  <span className="font-medium">{t("experience")}</span> {service.experience}
                                </div>
                              )}
                            </div>
                            
                            {/* Bottom Section */}
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-gray-400">
                                {service.createdAt ? getTimeSince(service.createdAt) : t("recently")}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={service.isAvailable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                                  {service.isAvailable ? t("available") : t("unavailable")}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="my-requests" className="mt-0">
                {userServiceRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-2">{t("noServiceRequestsFound")}</div>
                    <div className="text-gray-500 text-sm">{t("beFirstToRequest")}</div>
                  </div>
                ) : (
                  <div className="space-y-4 mb-nav">
                    {userServiceRequests.map((post) => (
                      <Card key={post.id} className="bg-white border-gray-200 overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                              {post.title}
                            </h3>
                            <div className="flex items-center gap-2">
                              {post.maxHourlyRate && (
                                <div className="flex items-center font-bold" style={{ color: "#d91c5c" }}>
                                  <span className="text-sm mr-1">{t("upTo")}</span>
                                  <Euro className="h-4 w-4 mr-1" />
                                  {(post.maxHourlyRate / 100).toFixed(0)}
                                  <span className="text-sm ml-1">{t("perHourFull")}</span>
                                </div>
                              )}
                              {post.urgency === "urgent" && (
                                <Badge className="bg-red-100  text-red-800  border-red-300 ">
                                  {t("urgent")}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-purple-100 bg-purple-900 text-purple-800 text-purple-200 border-purple-300 border-purple-700">
                              {post.serviceType}
                            </Badge>
                            {post.ageGroups && (
                              <Badge className="bg-gray-100 bg-gray-700 text-gray-800 text-gray-200">
                                {post.ageGroups}
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {post.description}
                          </p>
                          
                          <div className="text-sm text-gray-500 mb-3 space-y-1">
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-2" />
                              {post.location}
                            </div>
                            <div className="flex items-start">
                              <Clock className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-1">{post.schedule}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-400">
                              {getTimeSince(post.createdAt!)}
                            </div>
                            <Button 
                              size="default" 
                              className="text-white px-6 h-10 rounded-lg"
                              style={{ 
                                background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                              }}
                            >
                              {t("respond")}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Add Button - Top Right */}
        <Button
          className="fixed right-4 h-10 w-10 rounded-full text-white shadow-lg z-50 top-[calc(1rem_+_env(safe-area-inset-top))]"
          size="icon"
          onClick={() => setShowChoiceDialog(true)}
          data-testid="button-open-add-choice"
          style={{ 
            background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
          }}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Product Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-product-detail">
          {selectedItem && (
            <div>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900" data-testid="text-product-title">
                  {selectedItem.title}
                </DialogTitle>
              </DialogHeader>
              
              <div className="mt-4 space-y-6">
                {/* Image Carousel */}
                {selectedItem.imageUrls && selectedItem.imageUrls.length > 0 && (
                  <div className="relative">
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={selectedItem.imageUrls[selectedImageIndex]}
                        alt={`${selectedItem.title} - Image ${selectedImageIndex + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21,15 16,10 5,21"/%3E%3C/svg%3E';
                        }}
                        data-testid={`img-product-${selectedImageIndex}`}
                      />
                    </div>
                    
                    {/* Navigation arrows for multiple images */}
                    {selectedItem.imageUrls.length > 1 && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white/90 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImageIndex(prev => prev > 0 ? prev - 1 : selectedItem.imageUrls!.length - 1);
                          }}
                          data-testid="button-prev-image"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white/90 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImageIndex(prev => prev < selectedItem.imageUrls!.length - 1 ? prev + 1 : 0);
                          }}
                          data-testid="button-next-image"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        
                        {/* Image dots */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {selectedItem.imageUrls.map((_, index) => (
                            <button
                              key={index}
                              className={`w-2 h-2 rounded-full transition-all ${
                                index === selectedImageIndex
                                  ? 'bg-white'
                                  : 'bg-white/50 hover:bg-white/70'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImageIndex(index);
                              }}
                              data-testid={`dot-image-${index}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {/* Product Details */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center font-bold text-3xl" style={{ color: "#d91c5c" }}>
                      <Euro className="h-7 w-7 mr-2" />
                      <span data-testid="text-product-price">{(selectedItem.price / 100).toFixed(0)}</span>
                    </div>
                    <Badge className={getConditionStyle(selectedItem.condition)} data-testid="badge-product-condition">
                      {conditions.find(c => c.value === selectedItem.condition)?.label}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedItem.brand && (
                      <div>
                        <span className="font-medium text-gray-900">Brand:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-product-brand">{selectedItem.brand}</span>
                      </div>
                    )}
                    {selectedItem.size && (
                      <div>
                        <span className="font-medium text-gray-900">Size:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-product-size">{selectedItem.size}</span>
                      </div>
                    )}
                    {selectedItem.color && (
                      <div>
                        <span className="font-medium text-gray-900">Color:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-product-color">{selectedItem.color}</span>
                      </div>
                    )}
                    {selectedItem.material && (
                      <div>
                        <span className="font-medium text-gray-900">Material:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-product-material">{selectedItem.material}</span>
                      </div>
                    )}
                    {selectedItem.ageRange && (
                      <div>
                        <span className="font-medium text-gray-900">Age Range:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-product-age">{selectedItem.ageRange}</span>
                      </div>
                    )}
                    {selectedItem.season && (
                      <div>
                        <span className="font-medium text-gray-900">Season:</span>
                        <span className="ml-2 text-gray-600" data-testid="text-product-season">{selectedItem.season}</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <span className="font-medium text-gray-900">Description:</span>
                    <p className="mt-1 text-gray-600 text-sm leading-relaxed" data-testid="text-product-description">
                      {selectedItem.description}
                    </p>
                  </div>
                  
                  {selectedItem.measurements && (
                    <div>
                      <span className="font-medium text-gray-900">Measurements:</span>
                      <p className="mt-1 text-gray-600 text-sm" data-testid="text-product-measurements">
                        {selectedItem.measurements}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span data-testid="text-product-location">{selectedItem.location}</span>
                    </div>
                    <span data-testid="text-product-date">{getTimeSince(selectedItem.createdAt)}</span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => toggleSaved(selectedItem.id)}
                      variant="outline"
                      className="flex-1"
                      data-testid="button-save-product"
                    >
                      <Heart
                        className={`h-4 w-4 mr-2 ${
                          isItemSaved(selectedItem.id)
                            ? "fill-pink-500 text-pink-500"
                            : "text-gray-600"
                        }`}
                      />
                      {isItemSaved(selectedItem.id) ? "Saved" : "Save"}
                    </Button>
                    
                    {selectedItem.vintedUrl && (
                      <Button
                        onClick={() => window.open(selectedItem.vintedUrl!, '_blank')}
                        variant="outline"
                        className="px-4"
                        data-testid="button-view-vinted"
                      >
                        <span className="font-bold text-base">V</span>
                      </Button>
                    )}
                    
                    <Button
                      className="flex-1 text-white"
                      data-testid="button-message-seller"
                      style={{ 
                        background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                      }}
                    >
                      Message Seller
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={!!editingItem} onOpenChange={() => {
        setEditingItem(null);
        editForm.reset();
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-product">
          {editingItem && (
            <div>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Edit Product
                </DialogTitle>
              </DialogHeader>
              
              <div className="mt-4">
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              placeholder="Product title"
                              data-testid="input-edit-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field}
                              placeholder="Product description"
                              className="min-h-[100px]"
                              data-testid="textarea-edit-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (€)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              data-testid="input-edit-price"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="condition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-condition">
                                <SelectValue placeholder="Select condition" />
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

                    <FormField
                      control={editForm.control}
                      name="negotiable"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Negotiable Price
                            </FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Allow buyers to negotiate the price
                            </div>
                          </div>
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4"
                              data-testid="checkbox-edit-negotiable"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col gap-3 pt-4">
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingItem(null);
                            editForm.reset();
                          }}
                          className="flex-1"
                          data-testid="button-cancel-edit"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={updateProductMutation.isPending}
                          className="flex-1 text-white"
                          data-testid="button-save-edit"
                          style={{ 
                            background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                          }}
                        >
                          {updateProductMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          setEditingItem(null);
                          editForm.reset();
                          handleDeleteItem(editingItem.id);
                        }}
                        className="w-full"
                        data-testid="button-delete-edit"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Product
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Choice Dialog for Product/Service */}
      <Dialog open={showChoiceDialog} onOpenChange={setShowChoiceDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-add-choice">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 text-center">
              What would you like to add?
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 mt-4">
            <Button 
              onClick={() => {
                setShowChoiceDialog(false);
                setLocation("/marketplace/add");
              }}
              className="h-16 text-white text-lg font-semibold"
              data-testid="button-add-product-confirm"
              style={{ 
                background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
              }}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Product
            </Button>
            
            <Button 
              onClick={() => {
                setShowChoiceDialog(false);
                setLocation("/services/add");
              }}
              className="h-16 text-white text-lg font-semibold"
              data-testid="button-add-service"
              style={{ 
                background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
              }}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Service
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Info Modal */}
      <UserInfoModal
        profile={selectedUserProfile}
        open={showUserInfoModal}
        onOpenChange={setShowUserInfoModal}
      />

      {/* Navigation */}
      <Navigation includeMarketplace={true} />
    </div>
  );
}