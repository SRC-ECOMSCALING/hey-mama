import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, MapPin, CheckCircle, XCircle, LogOut, Users, BarChart3,
  Settings as SettingsIcon, Trash2, TreePine, Loader2, FlaskConical, Eye, EyeOff,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { Location } from "@shared/schema";

interface UploadResult {
  success: number;
  failed: number;
  errors: string[];
}

interface AdminStats {
  users: number;
  profiles: number;
  testProfiles: number;
  locations: number;
  pendingLocations: number;
  marketplaceItems: number;
}

interface AdminUser {
  id: string;
  email: string;
  isEmailVerified: boolean;
  subscriptionStatus: string | null;
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    location: string;
    isTestProfile: boolean;
    createdAt: string;
  } | null;
}

interface OsmImportResult {
  city: string;
  totalFound: number;
  imported: number;
  skippedExisting: number;
  skippedUnnamed: number;
  skippedNoCoords: number;
}

const LOCATION_CATEGORIES = [
  { value: "parco", label: "🌳 Parco" },
  { value: "biblioteca", label: "📚 Biblioteca" },
  { value: "museo", label: "🎨 Museo" },
  { value: "playground", label: "🎪 Playground" },
  { value: "piscina", label: "🏊 Piscina" },
  { value: "ristorante", label: "🍕 Ristorante" },
  { value: "cafe", label: "☕ Café" },
  { value: "centro-commerciale", label: "🛍️ Centro Commerciale" },
  { value: "teatro", label: "🎭 Teatro" },
  { value: "altro", label: "📍 Altro" },
];

export default function Admin() {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [osmCity, setOsmCity] = useState("");
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = !!user && user.email === "admin@claudio.com";

  // ===== Queries =====
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdmin,
  });

  const { data: adminUsers = [] } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin,
  });

  const { data: settings } = useQuery<{ showTestProfiles: boolean }>({
    queryKey: ["/api/admin/settings"],
    enabled: isAdmin,
  });

  const { data: adminLocations = [] } = useQuery<Location[]>({
    queryKey: ["/api/admin/locations"],
    enabled: isAdmin,
  });

  const invalidateAdmin = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
  };

  // ===== Mutations =====
  const toggleTestMutation = useMutation({
    mutationFn: async (data: { profileId: string; isTestProfile: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/profiles/${data.profileId}/test`, {
        isTestProfile: data.isTestProfile,
      });
      return res.json();
    },
    onSuccess: () => invalidateAdmin(),
    onError: () => toast({ title: "Errore", description: "Impossibile aggiornare il profilo", variant: "destructive" }),
  });

  const markAllTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/profiles/mark-all-test");
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateAdmin();
      toast({ title: "Fatto", description: data.message });
    },
    onError: () => toast({ title: "Errore", description: "Operazione fallita", variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateAdmin();
      toast({ title: "Utente eliminato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (showTestProfiles: boolean) => {
      const res = await apiRequest("PATCH", "/api/admin/settings", { showTestProfiles });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateAdmin();
      toast({
        title: "Impostazioni salvate",
        description: data.showTestProfiles
          ? "I profili test sono ora visibili nell'app"
          : "I profili test sono ora nascosti nell'app",
      });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile salvare", variant: "destructive" }),
  });

  const locationApprovalMutation = useMutation({
    mutationFn: async (data: { id: string; approved: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/locations/${data.id}`, { approved: data.approved });
      return res.json();
    },
    onSuccess: () => invalidateAdmin(),
    onError: () => toast({ title: "Errore", description: "Impossibile aggiornare il luogo", variant: "destructive" }),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/locations/${id}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateAdmin();
      toast({ title: "Luogo eliminato" });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile eliminare il luogo", variant: "destructive" }),
  });

  const osmImportMutation = useMutation({
    mutationFn: async (city: string) => {
      const res = await apiRequest("POST", "/api/admin/import-osm-parks", { city });
      return res.json() as Promise<OsmImportResult>;
    },
    onSuccess: (data) => {
      invalidateAdmin();
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({
        title: `Import ${data.city} completato`,
        description: `${data.imported} parchi importati (${data.skippedExisting} già presenti, ${data.skippedUnnamed} senza nome)`,
      });
      setOsmCity("");
    },
    onError: (e: any) => toast({ title: "Errore import OSM", description: e.message, variant: "destructive" }),
  });

  // Redirect if not admin
  if (!isLoading && !isAdmin) {
    setLocation("/");
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        toast({ title: "Errore", description: "Per favore carica un file CSV", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      toast({ title: "Logout effettuato", description: "Sei stato disconnesso con successo" });
      setLocation("/login");
    } catch {
      toast({ title: "Errore", description: "Errore durante il logout", variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({ title: "Errore", description: "Seleziona un file CSV", variant: "destructive" });
      return;
    }
    if (!category) {
      toast({ title: "Errore", description: "Seleziona una categoria", variant: "destructive" });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("csv", file);
      formData.append("category", category);

      const response = await fetch("/api/admin/upload-csv", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setResult(data);
      invalidateAdmin();

      toast({
        title: "Caricamento completato",
        description: `${data.success} locations caricate come "${LOCATION_CATEGORIES.find((c) => c.value === category)?.label}"`,
      });

      setFile(null);
      setCategory("");
      const fileInput = document.getElementById("csv-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Errore", description: "Errore durante il caricamento del CSV", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Caricamento...</p>
        </div>
      </div>
    );
  }

  const testCount = adminUsers.filter((u) => u.profile?.isTestProfile).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4 safe-top">
      <div className="max-w-4xl mx-auto py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Admin Panel
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Gestione completa di HeyMama!
            </p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2 w-full sm:w-auto shrink-0"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Utenti</span>
            </TabsTrigger>
            <TabsTrigger value="locations" data-testid="tab-locations">
              <MapPin className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Luoghi</span>
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <SettingsIcon className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Impostazioni</span>
            </TabsTrigger>
          </TabsList>

          {/* ===== DASHBOARD ===== */}
          <TabsContent value="dashboard" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500">Utenti</p>
                  <p className="text-3xl font-bold" data-testid="stat-users">{stats?.users ?? "–"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500">Profili</p>
                  <p className="text-3xl font-bold" data-testid="stat-profiles">{stats?.profiles ?? "–"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500">Profili test</p>
                  <p className="text-3xl font-bold text-amber-600" data-testid="stat-test-profiles">{stats?.testProfiles ?? "–"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500">Luoghi</p>
                  <p className="text-3xl font-bold" data-testid="stat-locations">{stats?.locations ?? "–"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500">Luoghi in attesa</p>
                  <p className="text-3xl font-bold text-orange-600" data-testid="stat-pending-locations">{stats?.pendingLocations ?? "–"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500">Annunci market</p>
                  <p className="text-3xl font-bold" data-testid="stat-items">{stats?.marketplaceItems ?? "–"}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== UTENTI ===== */}
          <TabsContent value="users" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Utenti registrati ({adminUsers.length})
                </CardTitle>
                <CardDescription>
                  {testCount} profili marcati come test. Usa lo switch per marcare/smarcare un profilo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllTestMutation.mutate()}
                  disabled={markAllTestMutation.isPending}
                  data-testid="button-mark-all-test"
                >
                  {markAllTestMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FlaskConical className="w-4 h-4 mr-2" />
                  )}
                  Marca tutti i profili come test
                </Button>

                <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                  {adminUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-2 border rounded-lg p-3 bg-white dark:bg-gray-800"
                      data-testid={`row-user-${u.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {u.profile ? `${u.profile.firstName} ${u.profile.lastName}` : "(senza profilo)"}
                          {u.profile?.isTestProfile && (
                            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">test</Badge>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{u.email}{u.profile?.location ? ` · ${u.profile.location}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {u.profile && (
                          <Switch
                            checked={u.profile.isTestProfile}
                            onCheckedChange={(checked) =>
                              toggleTestMutation.mutate({ profileId: u.profile!.id, isTestProfile: checked })
                            }
                            data-testid={`switch-test-${u.id}`}
                          />
                        )}
                        {u.email !== "admin@claudio.com" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (confirm(`Eliminare definitivamente ${u.email}?`)) {
                                deleteUserMutation.mutate(u.id);
                              }
                            }}
                            data-testid={`button-delete-user-${u.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {adminUsers.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Nessun utente</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== LUOGHI ===== */}
          <TabsContent value="locations" className="mt-4 space-y-4">
            {/* OSM import */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TreePine className="w-5 h-5" />
                  Importa parchi da OpenStreetMap
                </CardTitle>
                <CardDescription>
                  Importa tutti i parchi pubblici di una città (dati © OpenStreetMap contributors, licenza ODbL).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Città (es. Novara)"
                    value={osmCity}
                    onChange={(e) => setOsmCity(e.target.value)}
                    disabled={osmImportMutation.isPending}
                    data-testid="input-osm-city"
                  />
                  <Button
                    onClick={() => osmCity.trim() && osmImportMutation.mutate(osmCity.trim())}
                    disabled={!osmCity.trim() || osmImportMutation.isPending}
                    style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
                    data-testid="button-import-osm"
                  >
                    {osmImportMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Importa"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Locations list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Luoghi ({adminLocations.length})
                </CardTitle>
                <CardDescription>Approva o elimina i luoghi proposti dagli utenti.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[24rem] overflow-y-auto">
                  {adminLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between gap-2 border rounded-lg p-3 bg-white dark:bg-gray-800"
                      data-testid={`row-location-${loc.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {loc.name}
                          {!loc.approved && (
                            <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">in attesa</Badge>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{loc.category} · {loc.address}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={loc.approved ? "Nascondi" : "Approva"}
                          onClick={() => locationApprovalMutation.mutate({ id: loc.id, approved: !loc.approved })}
                          data-testid={`button-approve-location-${loc.id}`}
                        >
                          {loc.approved ? <EyeOff className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm(`Eliminare "${loc.name}"?`)) {
                              deleteLocationMutation.mutate(loc.id);
                            }
                          }}
                          data-testid={`button-delete-location-${loc.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {adminLocations.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Nessun luogo</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* CSV upload (existing feature) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Caricamento CSV Locations
                </CardTitle>
                <CardDescription>
                  Formato CSV: nome, indirizzo, descrizione, link google maps
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="csv-file">File CSV</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={uploading}
                    data-testid="input-csv-file"
                  />
                  {file && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">File selezionato: {file.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria Location</Label>
                  <Select value={category} onValueChange={setCategory} disabled={uploading}>
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue placeholder="Seleziona una categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!file || !category || uploading}
                  className="w-full"
                  style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
                  data-testid="button-upload-csv"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Caricamento in corso...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Carica CSV
                    </>
                  )}
                </Button>

                {result && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Successo</p>
                            <p className="text-2xl font-bold text-green-600" data-testid="text-success-count">{result.success}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Errori</p>
                            <p className="text-2xl font-bold text-red-600" data-testid="text-failed-count">{result.failed}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    {result.errors.length > 0 && (
                      <div className="sm:col-span-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 max-h-40 overflow-y-auto">
                          {result.errors.map((error, index) => (
                            <li key={index} className="list-disc list-inside break-words">{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== IMPOSTAZIONI ===== */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" />
                  Impostazioni app
                </CardTitle>
                <CardDescription>Impostazioni globali valide per tutti gli utenti.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4 border rounded-lg p-4 bg-white dark:bg-gray-800">
                  <div className="flex items-start gap-3">
                    {settings?.showTestProfiles ? (
                      <Eye className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">Mostra profili test</p>
                      <p className="text-sm text-gray-500">
                        Se disattivato, i profili marcati come test sono nascosti dalla scoperta e dalla mappa per tutti gli utenti.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.showTestProfiles ?? true}
                    onCheckedChange={(checked) => updateSettingsMutation.mutate(checked)}
                    disabled={updateSettingsMutation.isPending || settings === undefined}
                    data-testid="switch-show-test-profiles"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-back-home">
            Torna alla Home
          </Button>
        </div>
      </div>
    </div>
  );
}
