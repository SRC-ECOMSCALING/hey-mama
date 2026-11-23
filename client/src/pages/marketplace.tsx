import { useMemo, useRef, useState } from "react";
import { getMarketPrefs, setMarketPrefs, type MarketPrefs } from "@/lib/marketPrefs";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Heart, Search, MapPin, ExternalLink, Plus, Clock, ChevronLeft, ChevronRight, Pencil, Trash2, Loader2, Info,
  SlidersHorizontal, ShoppingBag, Wrench, Tag, HandCoins, ArrowUpDown, ImageOff, MessageCircle, ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { optionLabel, optionLabels } from "@/lib/optionLabels";
import type { MarketplaceItem, LookingForPost, Service, ServiceLookingForPost, Profile } from "@shared/schema";
import { insertMarketplaceItemSchema } from "@shared/schema";
import { z } from "zod";
import UserInfoModal from "@/components/user-info-modal";
import ReportBlockControls from "@/components/report-block";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations, type TranslationKey } from "@/lib/translations";
import CityPicker from "@/components/city-picker";
import PageSkeleton from "@/components/page-skeleton";
import AppHeader from "@/components/app-header";

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
  { value: "new-with-tags" },
  { value: "new-without-tags" },
  { value: "excellent" },
  { value: "good" },
  { value: "fair" },
  { value: "damaged" }
];

// Shown when a listing photo fails to load
const IMAGE_FALLBACK =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%23ccc" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21,15 16,10 5,21"/%3E%3C/svg%3E';

// Empty state per DESIGN.md: round pink tile, Sora title, one grey sentence
function EmptyState({ icon: Icon, title, text, action, testId }: { icon: LucideIcon; title: string; text: string; action?: ReactNode; testId?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center" data-testid={testId}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
        <Icon className="h-7 w-7 text-pink-500" />
      </div>
      <h2 className="font-display text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// Edit form schema
const buildEditProductSchema = (t: (key: TranslationKey) => string) => insertMarketplaceItemSchema.pick({
  title: true,
  description: true,
  price: true,
  condition: true,
  negotiable: true,
  location: true,
}).extend({
  title: z.string().min(1, t("titleRequiredError")),
  description: z.string().min(10, t("descriptionMinError")),
  price: z.number().min(0.01, t("invalidPriceError")),
  location: z.string().min(1, t("locationRequiredError")),
});

type EditProductFormData = z.infer<ReturnType<typeof buildEditProductSchema>>;

type MarketplaceItemWithSeller = MarketplaceItem & { sellerProfile?: Profile | null };

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("categoryAll");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedItem, setSelectedItem] = useState<MarketplaceItemWithSeller | null>(null);
  // The detail sheet keeps showing the last item while it slides out
  const lastSelectedItem = useRef<MarketplaceItemWithSeller | null>(null);
  if (selectedItem) lastSelectedItem.current = selectedItem;
  const sheetItem = selectedItem ?? lastSelectedItem.current;
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
  const [servicesSubTab, setServicesSubTab] = useState<string>(() => (getMarketPrefs()?.mode === "sell" ? "my-services" : "available"));

  const applyPrefs = (next: MarketPrefs) => {
    setMarketPrefs(next);
    setPrefs(next);
    setMainTab(next.interest === "services" ? "services" : "marketplace");
    setMarketSubTab(next.mode === "sell" ? "my-products" : "items");
    setServicesSubTab(next.mode === "sell" ? "my-services" : "available");
    setShowSetup(false);
  };

  // Only drop the city: going through applyPrefs would also reset the tabs
  // and bounce someone browsing services back to items.
  const setCityFilter = (city: string) => {
    if (!prefs) return;
    const next = { ...prefs, city };
    setMarketPrefs(next);
    setPrefs(next);
  };
  const clearCityFilter = () => setCityFilter("");
  const { toast } = useToast();
  const { t, language } = useLanguage();
  
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Edit form
  const editProductSchema = useMemo(() => buildEditProductSchema(t), [t]);
  const editForm = useForm<EditProductFormData>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      condition: "good",
      negotiable: false,
      location: "",
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
      location: item.location || "",
    });
  };

  // Handle edit form submission
  const handleEditSubmit = (data: EditProductFormData) => {
    if (editingItem) {
      updateProductMutation.mutate({ id: editingItem.id, updates: data });
    }
  };

  // Stored item categories are the Italian labels (hierarchical), so filter
  // with the Italian label regardless of the display language. The category
  // must travel as a ?category= query param: joining it into the path would
  // hit the /api/marketplace/items/:id route instead.
  const categoryFilter =
    selectedCategory === "categoryAll"
      ? undefined
      : translations.it[selectedCategory as keyof (typeof translations)["it"]];

  const { data: items = [], isLoading } = useQuery<MarketplaceItemWithSeller[]>({
    // Two-element key so invalidateQueries(["/api/marketplace/items"]) still
    // clears every category variant; the explicit queryFn sends the category
    // as a real query param (the default queryFn would join it into the path
    // and hit /api/marketplace/items/:id).
    queryKey: ["/api/marketplace/items", categoryFilter ?? "all"],
    queryFn: async () => {
      const url = categoryFilter
        ? `/api/marketplace/items?category=${encodeURIComponent(categoryFilter)}`
        : "/api/marketplace/items";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
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
    queryKey: ["/api/marketplace/looking-for", categoryFilter ?? "all"],
    queryFn: async () => {
      const url = categoryFilter
        ? `/api/marketplace/looking-for?category=${encodeURIComponent(categoryFilter)}`
        : "/api/marketplace/looking-for";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
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

  // Services offered by other moms, narrowed to the chosen city like items
  const availableServices = services
    .filter(service =>
      service.providerId !== user?.id &&
      service.isAvailable !== false &&
      (!cityFilter || (service.location || "").toLowerCase().includes(cityFilter))
    )
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  
  // Filter user's service requests
  const userServiceRequests = serviceLookingForPosts.filter(post => post.userId === user?.id);

  // "45 €"; cents are shown only when the price is not a whole amount
  const formatEuro = (priceInCents: number) => {
    const euros = priceInCents / 100;
    const amount = priceInCents % 100 === 0
      ? euros.toFixed(0)
      : euros.toFixed(2).replace(".", language === "it" ? "," : ".");
    return `${amount} €`;
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

  // Delete one of the user's own service requests ("Le mie richieste")
  const handleDeleteServiceRequest = async (postId: string) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      const response = await fetch(`/api/services/looking-for/${postId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete service request');
      }
      queryClient.invalidateQueries({ queryKey: ["/api/services/looking-for"] });
    } catch (error) {
      console.error('Error deleting service request:', error);
      toast({
        title: t("error"),
        variant: "destructive",
      });
    }
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
        toast({ title: t("error"), description: t("deleteItemFailed"), variant: "destructive" });
      }
    }
  };



  if (isLoading) {
    return <PageSkeleton variant="grid" />;
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

  const openItem = (item: MarketplaceItemWithSeller) => {
    setSelectedItem(item);
    setSelectedImageIndex(0);
  };

  const openSetup = () => {
    setDraftCity(prefs?.city ?? "");
    setDraftInterest(prefs?.interest ?? null);
    setDraftMode(prefs?.mode ?? null);
    setShowSetup(true);
  };

  // Choice tiles of the preferences screen: white card, pink tint + magenta ring when picked
  const choiceTile = (selected: boolean) =>
    `rounded-3xl p-4 text-left transition-colors ${
      selected ? "bg-pink-50 text-pink-700 ring-2 ring-inset ring-pink-500" : "bg-white text-gray-900"
    }`;
  const choiceIcon = (selected: boolean) => `mb-3 h-6 w-6 ${selected ? "text-pink-500" : "text-gray-900"}`;

  // Second-level switch (for sale / mine, available / mine / requests)
  const scopeTrigger = "h-9 min-w-0 px-1.5 text-[13px]";

  // One tile of the 2-column grid. `mine` swaps the save heart for the edit shortcut.
  const renderListing = (item: MarketplaceItemWithSeller, mine: boolean) => {
    const saved = isItemSaved(item.id);
    const badge = item.isAvailable === false ? t("unavailable") : item.negotiable ? t("negotiable") : null;
    return (
      <div key={item.id} className="relative">
        <button
          type="button"
          onClick={() => openItem(item)}
          className="flex w-full flex-col gap-2 text-left"
          data-testid={mine ? `card-my-product-${item.id}` : `card-product-${item.id}`}
        >
          <span className="relative block w-full">
            {item.imageUrls && item.imageUrls.length > 0 ? (
              <img
                src={item.imageUrls[0]}
                loading="lazy"
                decoding="async"
                alt={item.title}
                className="aspect-square w-full rounded-[22px] bg-gray-100 object-cover"
                onError={(e) => {
                  e.currentTarget.src = IMAGE_FALLBACK;
                }}
              />
            ) : (
              <span className="flex aspect-square w-full items-center justify-center rounded-[22px] bg-gray-100">
                <ImageOff className="h-7 w-7 text-gray-500" aria-hidden="true" />
                <span className="sr-only">{t("noImage")}</span>
              </span>
            )}
            {badge && (
              <span className="absolute left-2.5 top-2.5 inline-flex h-[26px] items-center rounded-full bg-white px-2.5 text-[11px] font-semibold text-gray-900">
                {badge}
              </span>
            )}
          </span>
          <span className="flex flex-col gap-1 px-1">
            <span className="font-display text-lg font-bold leading-[1.1] text-gray-900">{formatEuro(item.price)}</span>
            <span className="line-clamp-2 text-sm font-medium leading-tight text-gray-900">{item.title}</span>
            <span className="truncate text-xs text-gray-600">
              {[optionLabel(t, item.condition), item.location].filter(Boolean).join(" · ")}
            </span>
          </span>
        </button>
        {mine ? (
          <button
            type="button"
            onClick={() => handleEditItem(item)}
            className="glass absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-gray-900"
            aria-label={t("edit")}
            data-testid={`button-edit-${item.id}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => toggleSaved(item.id)}
            className="glass absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full"
            aria-label={saved ? t("marketUnsaveAria") : t("marketSaveAria")}
            aria-pressed={saved}
            data-testid={`button-save-${item.id}`}
          >
            <Heart className={`h-[18px] w-[18px] ${saved ? "fill-pink-500 text-pink-500" : "text-gray-900"}`} />
          </button>
        )}
      </div>
    );
  };

  // Price of a service: "15 €/h"
  const renderRate = (cents: number, prefix?: string) => (
    <p className="shrink-0 font-display text-lg font-bold leading-tight text-gray-900">
      {prefix && <span className="mr-1 font-sans text-xs font-medium text-gray-600">{prefix}</span>}
      {formatEuro(cents)}
      <span className="font-sans text-xs font-medium text-gray-600">{t("perHour")}</span>
    </p>
  );

  // Tags shared by service cards: type in violet, age groups in grey
  const renderServiceTags = (serviceType: string, ageGroups: string | null, lead?: ReactNode) => (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {lead}
      <span className="tag-violet">{optionLabel(t, serviceType)}</span>
      {(ageGroups ?? "")
        .split(",")
        .map((group) => group.trim())
        .filter(Boolean)
        .map((group) => (
          <span key={group} className="tag-neutral">{optionLabel(t, group)}</span>
        ))}
    </div>
  );

  const selectedIsMine = !!sheetItem && sheetItem.sellerId === user?.id;
  const selectedSeller = sheetItem?.sellerProfile ?? null;
  const selectedSaved = !!sheetItem && isItemSaved(sheetItem.id);
  const selectedDetails: { label: string; value: string; testId: string }[] = sheetItem
    ? [
        { label: t("brandLabel"), value: sheetItem.brand, testId: "text-product-brand" },
        { label: t("sizeLabel"), value: optionLabel(t, sheetItem.size), testId: "text-product-size" },
        { label: t("colorLabel"), value: optionLabel(t, sheetItem.color), testId: "text-product-color" },
        { label: t("materialLabel"), value: optionLabel(t, sheetItem.material), testId: "text-product-material" },
        { label: t("ageRangeLabel"), value: sheetItem.ageRange ?? "", testId: "text-product-age" },
        { label: t("seasonLabel"), value: optionLabel(t, sheetItem.season), testId: "text-product-season" },
      ].filter((detail) => !!detail.value)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      {/* First-access setup: choose city / interest / buy-or-sell */}
      {showSetup && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-gray-50 safe-top">
          <div className="mx-auto max-w-md px-5 pb-16 pt-10">
            <div className="mb-8">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
                <ShoppingBag className="h-7 w-7 text-pink-500" />
              </div>
              <h2 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-gray-900">
                {t("marketWelcome")}
              </h2>
              <p className="mt-2.5 text-base leading-relaxed text-gray-600">{t("marketWelcomeSubtitle")}</p>
            </div>

            {/* Posizione */}
            <div className="mb-6">
              <p className="section-label mb-2.5">{t("marketWhereAreYou")}</p>
              <CityPicker value={draftCity} onChange={setDraftCity} allowAll testId="input-setup-city" />
              <p className="mt-2 text-xs leading-relaxed text-gray-600">{t("cityHint")}</p>
            </div>

            {/* Interesse */}
            <div className="mb-6">
              <p className="section-label mb-2.5">{t("whatInterestsYou")}</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDraftInterest("items")}
                  aria-pressed={draftInterest === "items"}
                  className={choiceTile(draftInterest === "items")}
                  data-testid="setup-interest-items"
                >
                  <Tag className={choiceIcon(draftInterest === "items")} />
                  <p className="text-[15px] font-semibold">{t("itemsOption")}</p>
                  <p className="mt-0.5 text-xs text-gray-600">{t("itemsOptionHint")}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDraftInterest("services")}
                  aria-pressed={draftInterest === "services"}
                  className={choiceTile(draftInterest === "services")}
                  data-testid="setup-interest-services"
                >
                  <Wrench className={choiceIcon(draftInterest === "services")} />
                  <p className="text-[15px] font-semibold">{t("servicesOption")}</p>
                  <p className="mt-0.5 text-xs text-gray-600">{t("servicesOptionHint")}</p>
                </button>
              </div>
            </div>

            {/* Compra o vendi */}
            <div className="mb-8">
              <p className="section-label mb-2.5">{t("buyOrSell")}</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDraftMode("buy")}
                  aria-pressed={draftMode === "buy"}
                  className={choiceTile(draftMode === "buy")}
                  data-testid="setup-mode-buy"
                >
                  <ShoppingBag className={choiceIcon(draftMode === "buy")} />
                  <p className="text-[15px] font-semibold">{t("buyOption")}</p>
                  <p className="mt-0.5 text-xs text-gray-600">{t("buyOptionHint")}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMode("sell")}
                  aria-pressed={draftMode === "sell"}
                  className={choiceTile(draftMode === "sell")}
                  data-testid="setup-mode-sell"
                >
                  <HandCoins className={choiceIcon(draftMode === "sell")} />
                  <p className="text-[15px] font-semibold">{t("sellOption")}</p>
                  <p className="mt-0.5 text-xs text-gray-600">{t("sellOptionHint")}</p>
                </button>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!draftInterest || !draftMode}
              onClick={() =>
                draftInterest && draftMode &&
                applyPrefs({ city: draftCity.trim(), interest: draftInterest, mode: draftMode })
              }
              data-testid="button-setup-start"
            >
              {t("marketStart")}
            </Button>
            {prefs && (
              <Button
                variant="ghost"
                className="mt-2 w-full text-gray-600"
                onClick={() => setShowSetup(false)}
                data-testid="button-setup-cancel"
              >
                {t("cancel")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Header: big title + "Sell" pill (product or service) */}
      <AppHeader
        title={t("marketplace")}
        left="none"
        right={
          <button
            type="button"
            onClick={() => setShowChoiceDialog(true)}
            className="glass-btn inline-flex h-12 shrink-0 items-center gap-2 rounded-full pl-3.5 pr-4 text-sm font-semibold text-gray-900"
            data-testid="button-open-add-choice"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {t("marketSell")}
          </button>
        }
      />

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <main className="space-y-3.5 px-5">
          {/* Search + city */}
          <div className="flex gap-2.5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-[18px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-900" />
              <Input
                placeholder={t("marketSearchPlaceholder")}
                aria-label={t("search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-[52px] rounded-full border-0 pl-[46px] pr-4 text-sm font-medium placeholder:text-gray-600"
                data-testid="input-market-search"
              />
            </div>
            <CityPicker
              value={prefs?.city ?? ""}
              onChange={setCityFilter}
              allowAll
              variant="pill"
              testId="chip-city-filter"
            />
          </div>

          {/* Items / services + preferences */}
          <div className="flex items-center gap-2.5">
            <TabsList className="grid h-12 min-w-0 flex-1 grid-cols-2 gap-1" aria-label={t("marketListingType")}>
              <TabsTrigger value="marketplace" data-testid="tab-main-items">{t("itemsOption")}</TabsTrigger>
              <TabsTrigger value="services" data-testid="tab-main-services">{t("servicesOption")}</TabsTrigger>
            </TabsList>
            <button
              type="button"
              onClick={openSetup}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-gray-900"
              aria-label={t("marketPreferences")}
              title={t("marketPreferences")}
              data-testid="button-market-prefs"
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" />
            </button>
          </div>

          <TabsContent value="marketplace" className="mt-0">
            <Tabs value={marketSubTab} onValueChange={setMarketSubTab} className="space-y-3.5">
              <TabsList className="grid h-11 w-full grid-cols-2 gap-1">
                <TabsTrigger value="items" className={scopeTrigger} data-testid="tab-items-for-sale">
                  <span className="truncate">{t("marketScopeForSale")}</span>
                </TabsTrigger>
                <TabsTrigger value="my-products" className={scopeTrigger} data-testid="tab-my-products">
                  <span className="truncate">{t("marketScopeMine")}</span>
                </TabsTrigger>
              </TabsList>

              {/* Category chips + sort */}
              <div
                role="group"
                aria-label={t("marketCategories")}
                className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5"
              >
                {categoryKeys.map(categoryKey => {
                  const active = selectedCategory === categoryKey;
                  return (
                    <button
                      key={categoryKey}
                      type="button"
                      onClick={() => setSelectedCategory(categoryKey)}
                      aria-pressed={active}
                      className={active ? "chip chip-on" : "chip"}
                      data-testid={`chip-category-${categoryKey}`}
                    >
                      {t(categoryKey)}
                    </button>
                  );
                })}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger
                    aria-label={t("sortBy")}
                    className="h-9 w-auto shrink-0 gap-1.5 whitespace-nowrap rounded-full border-0 px-3.5 py-0 text-[13px] font-medium text-gray-900"
                    data-testid="select-market-sort"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
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

              <TabsContent value="items" className="mt-0 pt-1">
                {filteredItems.length === 0 ? (
                  <EmptyState
                    icon={ShoppingBag}
                    title={t("noItemsFound")}
                    text={cityFilter
                      ? t("noItemsInCity").replace("{city}", prefs?.city ?? "")
                      : t("tryDifferentCategory")}
                    action={cityFilter ? (
                      <Button variant="outline" onClick={clearCityFilter} data-testid="button-clear-city-empty">
                        {t("showAllCities")}
                      </Button>
                    ) : undefined}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    {filteredItems.map((item) => renderListing(item, false))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="my-products" className="mt-0 pt-1">
                {userItems.length === 0 ? (
                  <EmptyState
                    icon={Tag}
                    title={t("noProductsYet")}
                    text={t("marketNoProductsHint")}
                    action={
                      <Button onClick={() => setLocation("/marketplace/add")} data-testid="button-empty-add-product">
                        <Plus />
                        {t("addProduct")}
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    {userItems.map((item) => renderListing(item, true))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="services" className="mt-0">
            <Tabs value={servicesSubTab} onValueChange={setServicesSubTab} className="space-y-3.5">
              <TabsList className="grid h-11 w-full grid-cols-3 gap-1">
                <TabsTrigger value="available" className={scopeTrigger} data-testid="tab-available-services">
                  <span className="truncate">{t("availableServices")}</span>
                </TabsTrigger>
                <TabsTrigger value="my-services" className={scopeTrigger} data-testid="tab-my-services">
                  <span className="truncate">{t("marketScopeMyServices")}</span>
                </TabsTrigger>
                <TabsTrigger value="my-requests" className={scopeTrigger} data-testid="tab-my-requests">
                  <span className="truncate">{t("marketScopeMyRequests")}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="available" className="mt-0 pt-1">
                {availableServices.length === 0 ? (
                  <EmptyState
                    icon={Wrench}
                    title={t("noServicesAvailable")}
                    text={cityFilter
                      ? t("noServicesInCity").replace("{city}", prefs?.city ?? "")
                      : t("noServicesAvailableHint")}
                    action={cityFilter ? (
                      <Button variant="outline" onClick={clearCityFilter} data-testid="button-clear-city-services">
                        {t("showAllCities")}
                      </Button>
                    ) : undefined}
                    testId="empty-available-services"
                  />
                ) : (
                  <div className="space-y-3">
                    {availableServices.map((service) => (
                      <article key={service.id} className="card-float p-4" data-testid={`card-service-${service.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="min-w-0 font-display text-[17px] font-semibold leading-snug text-gray-900">{service.title}</h3>
                          {service.hourlyRate ? renderRate(service.hourlyRate) : null}
                        </div>
                        {renderServiceTags(service.serviceType, service.ageGroups)}
                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">{service.description}</p>
                        <div className="mt-3.5 flex items-center justify-between gap-3">
                          <p className="flex min-w-0 items-center gap-1.5 text-xs text-gray-600">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {service.location} · {service.createdAt ? getTimeSince(service.createdAt) : t("recently")}
                            </span>
                          </p>
                          <Button
                            className="h-10 shrink-0 rounded-full px-5"
                            onClick={() => setLocation(`/market-chat/service:${service.id}/${service.providerId}`)}
                            data-testid={`button-contact-service-${service.id}`}
                          >
                            {t("contact")}
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="my-services" className="mt-0 pt-1">
                {userServices.length === 0 ? (
                  <EmptyState
                    icon={Wrench}
                    title={t("noServicesYet")}
                    text={t("marketNoServicesHint")}
                    action={
                      <Button onClick={() => setLocation("/services/add")} data-testid="button-empty-add-service">
                        <Plus />
                        {t("addService")}
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {userServices.map((service) => (
                      <article key={service.id} className="card-float p-4" data-testid={`card-my-service-${service.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="min-w-0 font-display text-[17px] font-semibold leading-snug text-gray-900">{service.title}</h3>
                          {service.hourlyRate ? renderRate(service.hourlyRate) : null}
                        </div>
                        {renderServiceTags(
                          service.serviceType,
                          service.ageGroups,
                          <span className={service.isAvailable ? "tag-pink" : "tag-neutral"}>
                            {service.isAvailable ? t("available") : t("unavailable")}
                          </span>
                        )}
                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">{service.description}</p>
                        {service.experience && (
                          <p className="mt-2 text-xs text-gray-600">
                            <span className="font-semibold text-gray-900">{t("experience")}</span> {service.experience}
                          </p>
                        )}
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-600">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {service.location} · {service.createdAt ? getTimeSince(service.createdAt) : t("recently")}
                          </span>
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="my-requests" className="mt-0 pt-1">
                {userServiceRequests.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title={t("noServiceRequestsFound")}
                    text={t("beFirstToRequest")}
                  />
                ) : (
                  <div className="space-y-3">
                    {userServiceRequests.map((post) => (
                      <article key={post.id} className="card-float p-4" data-testid={`card-service-request-${post.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="min-w-0 font-display text-[17px] font-semibold leading-snug text-gray-900">{post.title}</h3>
                          {post.maxHourlyRate ? renderRate(post.maxHourlyRate, t("upTo")) : null}
                        </div>
                        {renderServiceTags(
                          post.serviceType,
                          post.ageGroups,
                          post.urgency === "urgent" ? <span className="tag-pink">{t("urgent")}</span> : undefined
                        )}
                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">{post.description}</p>
                        <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{post.location}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-1">{post.schedule}</span>
                          </p>
                        </div>
                        <div className="mt-3.5 flex items-center justify-between gap-3">
                          <p className="text-xs text-gray-600">{getTimeSince(post.createdAt!)}</p>
                          <Button
                            variant="outline"
                            className="h-10 shrink-0 rounded-full px-5 text-destructive"
                            onClick={() => handleDeleteServiceRequest(post.id)}
                            data-testid={`button-delete-service-request-${post.id}`}
                          >
                            <Trash2 />
                            {t("delete")}
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </main>
      </Tabs>

      {/* Product detail sheet */}
      <Drawer open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DrawerContent aria-describedby={undefined} data-testid="dialog-product-detail">
          {sheetItem && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
                {/* Photos */}
                {sheetItem.imageUrls && sheetItem.imageUrls.length > 0 && (
                  <div className="relative mb-4">
                    <div className="aspect-square w-full overflow-hidden rounded-3xl bg-gray-100">
                      <img
                        src={sheetItem.imageUrls[selectedImageIndex]}
                        alt={`${sheetItem.title} · ${t("marketPhotoN").replace("{n}", String(selectedImageIndex + 1))}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = IMAGE_FALLBACK;
                        }}
                        data-testid={`img-product-${selectedImageIndex}`}
                      />
                    </div>

                    {/* Navigation arrows for multiple images */}
                    {sheetItem.imageUrls.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="glass absolute left-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-gray-900"
                          aria-label={t("marketPrevPhoto")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImageIndex(prev => prev > 0 ? prev - 1 : sheetItem.imageUrls!.length - 1);
                          }}
                          data-testid="button-prev-image"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          className="glass absolute right-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-gray-900"
                          aria-label={t("marketNextPhoto")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImageIndex(prev => prev < sheetItem.imageUrls!.length - 1 ? prev + 1 : 0);
                          }}
                          data-testid="button-next-image"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>

                        {/* Image dots */}
                        <div className="glass absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-2">
                          {sheetItem.imageUrls.map((_, index) => (
                            <button
                              key={index}
                              type="button"
                              aria-label={t("marketPhotoN").replace("{n}", String(index + 1))}
                              aria-current={index === selectedImageIndex}
                              className={`h-2 rounded-full transition-all ${
                                index === selectedImageIndex ? "w-4 bg-pink-500" : "w-2 bg-gray-900/30"
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

                {/* Title + price */}
                <DrawerTitle className="text-[22px]" data-testid="text-product-title">
                  {sheetItem.title}
                </DrawerTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <p className="font-display text-[28px] font-bold leading-none tracking-tight text-gray-900" data-testid="text-product-price">
                    {formatEuro(sheetItem.price)}
                  </p>
                  {sheetItem.negotiable && <span className="tag-pink">{t("negotiable")}</span>}
                  {sheetItem.isAvailable === false && <span className="tag-neutral">{t("unavailable")}</span>}
                </div>

                {/* Details as chips */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="tag-neutral" data-testid="badge-product-condition">
                    {optionLabel(t, sheetItem.condition)}
                  </span>
                  {selectedDetails.map((detail) => (
                    <span key={detail.testId} className="tag-neutral">
                      <span className="text-gray-600">{detail.label}</span>
                      <span data-testid={detail.testId}>{detail.value}</span>
                    </span>
                  ))}
                </div>

                <p className="mt-3.5 flex items-center gap-1.5 text-[13px] text-gray-600">
                  <MapPin className="h-4 w-4 shrink-0 text-pink-500" />
                  <span className="min-w-0 truncate" data-testid="text-product-location">{sheetItem.location}</span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0" data-testid="text-product-date">{getTimeSince(sheetItem.createdAt)}</span>
                </p>

                <div className="mt-5">
                  <h3 className="section-label">{t("description")}</h3>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-900" data-testid="text-product-description">
                    {sheetItem.description}
                  </p>
                </div>

                {sheetItem.measurements && (
                  <div className="mt-5">
                    <h3 className="section-label">{t("measurementsLabel")}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-gray-900" data-testid="text-product-measurements">
                      {sheetItem.measurements}
                    </p>
                  </div>
                )}

                {/* Seller */}
                {!selectedIsMine && (
                  <div className="mt-5 flex items-center gap-3 rounded-3xl bg-gray-50 p-3">
                    {selectedSeller?.photoUrls?.[0] ? (
                      <img
                        src={selectedSeller.photoUrls[0]}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-100 font-display text-base font-semibold text-pink-700">
                        {(selectedSeller?.firstName ?? t("seller")).charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-600">{t("seller")}</p>
                      <p className="truncate font-display text-[15px] font-semibold text-gray-900">
                        {selectedSeller ? `${selectedSeller.firstName} ${selectedSeller.lastName}` : t("unknownSeller")}
                      </p>
                    </div>
                    {selectedSeller && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserProfile(selectedSeller);
                          setShowUserInfoModal(true);
                        }}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-gray-900"
                        aria-label={t("marketSellerProfile")}
                        data-testid={`button-info-seller-${sheetItem.id}`}
                      >
                        <Info className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Secondary actions */}
                <div className="mt-4 flex gap-2.5">
                  <Button
                    onClick={() => toggleSaved(sheetItem.id)}
                    variant="outline"
                    className="flex-1"
                    aria-pressed={selectedSaved}
                    data-testid="button-save-product"
                  >
                    <Heart className={selectedSaved ? "fill-pink-500 text-pink-500" : "text-gray-900"} />
                    {selectedSaved ? t("saved") : t("save")}
                  </Button>

                  {sheetItem.vintedUrl && (
                    <Button
                      onClick={() => window.open(sheetItem.vintedUrl!, '_blank')}
                      variant="outline"
                      className="flex-1"
                      data-testid="button-view-vinted"
                    >
                      <ExternalLink />
                      {t("viewOnVinted")}
                    </Button>
                  )}
                </div>

                {/* Report / block seller (App Store 1.2) */}
                {!selectedIsMine && (
                  <ReportBlockControls
                    targetUserId={sheetItem.sellerId}
                    targetType="marketplace_item"
                    targetId={sheetItem.id}
                    onBlocked={() => setSelectedItem(null)}
                    className="mt-4 border-t border-gray-100 pt-4"
                  />
                )}
              </div>

              {/* Main action */}
              <div
                className="shrink-0 border-t border-gray-100 px-5 pt-3"
                style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
              >
                {selectedIsMine ? (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      const item = sheetItem;
                      setSelectedItem(null);
                      handleEditItem(item);
                    }}
                    data-testid={`button-edit-product-main-${sheetItem.id}`}
                  >
                    <Pencil />
                    {t("edit")}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full"
                    data-testid="button-message-seller"
                    onClick={() => {
                      const sellerId = sheetItem.sellerId;
                      const itemId = sheetItem.id;
                      setSelectedItem(null);
                      setLocation(`/market-chat/${itemId}/${sellerId}`);
                    }}
                  >
                    <MessageCircle />
                    {t("marketWriteSeller")}
                  </Button>
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Edit Product Modal */}
      <Dialog open={!!editingItem} onOpenChange={() => {
        setEditingItem(null);
        editForm.reset();
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined} data-testid="dialog-edit-product">
          {editingItem && (
            <div>
              <DialogHeader>
                <DialogTitle>{t("editProduct")}</DialogTitle>
              </DialogHeader>

              <div className="mt-5">
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("titleLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={t("productTitlePlaceholder")}
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
                          <FormLabel>{t("description")}</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder={t("productDescriptionShortPlaceholder")}
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
                          <FormLabel>{t("priceEuro")}</FormLabel>
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
                          <FormLabel>{t("condition")}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-condition">
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

                    <FormField
                      control={editForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("cityLabel")}</FormLabel>
                          <FormControl>
                            <CityPicker value={field.value ?? ""} onChange={field.onChange} testId="select-edit-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="negotiable"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4 space-y-0 rounded-2xl bg-gray-50 p-4">
                          <div className="space-y-1.5">
                            <FormLabel className="text-[15px] font-semibold">
                              {t("negotiablePrice")}
                            </FormLabel>
                            <p className="text-[13px] leading-snug text-gray-600">
                              {t("allowNegotiation")}
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-edit-negotiable"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col gap-2.5 pt-3">
                      <Button
                        type="submit"
                        size="lg"
                        disabled={updateProductMutation.isPending}
                        className="w-full"
                        data-testid="button-save-edit"
                      >
                        {updateProductMutation.isPending ? (
                          <>
                            <Loader2 className="animate-spin" />
                            {t("updating")}
                          </>
                        ) : (
                          t("saveChanges")
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingItem(null);
                          editForm.reset();
                        }}
                        className="w-full"
                        data-testid="button-cancel-edit"
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingItem(null);
                          editForm.reset();
                          handleDeleteItem(editingItem.id);
                        }}
                        className="w-full text-destructive hover:text-destructive"
                        data-testid="button-delete-edit"
                      >
                        <Trash2 />
                        {t("deleteProduct")}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sell: product or service */}
      <Drawer open={showChoiceDialog} onOpenChange={setShowChoiceDialog}>
        <DrawerContent aria-describedby={undefined} data-testid="dialog-add-choice">
          <div className="px-5 pt-5" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
            <DrawerTitle>{t("whatToAdd")}</DrawerTitle>

            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowChoiceDialog(false);
                  setLocation("/marketplace/add");
                }}
                className="flex w-full items-center gap-3.5 rounded-3xl bg-gray-50 p-4 text-left"
                data-testid="button-add-product-confirm"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-50">
                  <Tag className="h-5 w-5 text-pink-500" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold text-gray-900">{t("addProduct")}</span>
                  <span className="mt-0.5 block text-[13px] text-gray-600">{t("itemsOptionHint")}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowChoiceDialog(false);
                  setLocation("/services/add");
                }}
                className="flex w-full items-center gap-3.5 rounded-3xl bg-gray-50 p-4 text-left"
                data-testid="button-add-service"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-50">
                  <Wrench className="h-5 w-5 text-pink-500" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold text-gray-900">{t("addService")}</span>
                  <span className="mt-0.5 block text-[13px] text-gray-600">{t("servicesOptionHint")}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" />
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* User Info Modal */}
      <UserInfoModal
        profile={selectedUserProfile}
        open={showUserInfoModal}
        onOpenChange={setShowUserInfoModal}
      />

    </div>
  );
}
