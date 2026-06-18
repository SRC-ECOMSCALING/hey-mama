import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, MapPin, CheckCircle, XCircle, LogOut, Users, BarChart3,
  Settings as SettingsIcon, Trash2, TreePine, Loader2, FlaskConical, Eye, EyeOff,
  ShoppingBag, Wrench, Home, Search, ShieldCheck, BadgeCheck, CreditCard,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { Location } from "@shared/schema";
import adminLogo from "@assets/admin_logo_gradient_text.png";

interface UploadResult { success: number; failed: number; errors: string[] }
interface AdminStats {
  users: number; verifiedUsers: number; subscribedUsers: number;
  profiles: number; testProfiles: number;
  locations: number; pendingLocations: number;
  marketplaceItems: number; services: number;
}
interface AdminUser {
  id: string; email: string; isEmailVerified: boolean; subscriptionStatus: string | null;
  isAdmin: boolean; isEnvAdmin: boolean;
  profile: { id: string; firstName: string; lastName: string; location: string; isTestProfile: boolean; createdAt: string } | null;
}
interface AdminItem { id: string; title: string; price: number; category: string; condition: string; createdAt: string; sellerName: string }
interface AdminService { id: string; title: string; serviceType: string; hourlyRate: number | null; location: string; isAvailable: boolean | null; createdAt: string; providerName: string }
interface OsmImportResult { city: string; totalFound: number; imported: number; skippedExisting: number; skippedUnnamed: number; skippedNoCoords: number }

const LOCATION_CATEGORIES = [
  { value: "parco", label: "🌳 Parco" }, { value: "biblioteca", label: "📚 Biblioteca" },
  { value: "museo", label: "🎨 Museo" }, { value: "playground", label: "🎪 Playground" },
  { value: "piscina", label: "🏊 Piscina" }, { value: "ristorante", label: "🍕 Ristorante" },
  { value: "cafe", label: "☕ Café" }, { value: "centro-commerciale", label: "🛍️ Centro Commerciale" },
  { value: "teatro", label: "🎭 Teatro" }, { value: "altro", label: "📍 Altro" },
];

type SectionKey = "dashboard" | "users" | "admins" | "test" | "locations" | "marketplace" | "services" | "settings";
const NAV: { key: SectionKey; label: string; icon: typeof Home }[] = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "users", label: "Utenti", icon: Users },
  { key: "admins", label: "Amministratori", icon: ShieldCheck },
  { key: "test", label: "Profili Test", icon: FlaskConical },
  { key: "locations", label: "Luoghi", icon: MapPin },
  { key: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { key: "services", label: "Servizi", icon: Wrench },
  { key: "settings", label: "Impostazioni", icon: SettingsIcon },
];

function eur(cents: number | null) {
  return cents == null ? "—" : `€${(cents / 100).toFixed(0)}`;
}

export default function Admin() {
  const { user, isLoading, isAdmin: isAdminUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [section, setSection] = useState<SectionKey>("dashboard");
  const [userSearch, setUserSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [osmCity, setOsmCity] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");

  const isAdmin = isAdminUser;

  const { data: stats } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"], enabled: isAdmin });
  const { data: adminUsers = [] } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"], enabled: isAdmin });
  const { data: settings } = useQuery<{ showTestProfiles: boolean }>({ queryKey: ["/api/admin/settings"], enabled: isAdmin });
  const { data: adminLocations = [] } = useQuery<Location[]>({ queryKey: ["/api/admin/locations"], enabled: isAdmin });
  const { data: adminItems = [] } = useQuery<AdminItem[]>({ queryKey: ["/api/admin/marketplace"], enabled: isAdmin });
  const { data: adminServices = [] } = useQuery<AdminService[]>({ queryKey: ["/api/admin/services"], enabled: isAdmin });

  const invalidate = (...keys: string[]) =>
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const invalidateAll = () =>
    invalidate("/api/admin/stats", "/api/admin/users", "/api/admin/locations", "/api/admin/settings", "/api/admin/marketplace", "/api/admin/services");

  const toggleTest = useMutation({
    mutationFn: async (d: { profileId: string; isTestProfile: boolean }) =>
      (await apiRequest("PATCH", `/api/admin/profiles/${d.profileId}/test`, { isTestProfile: d.isTestProfile })).json(),
    onSuccess: () => invalidateAll(),
    onError: () => toast({ title: "Errore", description: "Impossibile aggiornare il profilo", variant: "destructive" }),
  });
  const setAllTest = useMutation({
    mutationFn: async (isTest: boolean) => (await apiRequest("POST", "/api/admin/profiles/set-all-test", { isTest })).json(),
    onSuccess: (data: any) => { invalidateAll(); toast({ title: "Fatto", description: data.message }); },
    onError: () => toast({ title: "Errore", description: "Operazione fallita", variant: "destructive" }),
  });
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => (await apiRequest("DELETE", `/api/admin/users/${userId}`)).json(),
    onSuccess: () => { invalidateAll(); toast({ title: "Utente eliminato" }); },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
  const setAdmin = useMutation({
    mutationFn: async (d: { userId: string; isAdmin: boolean }) =>
      (await apiRequest("PATCH", `/api/admin/users/${d.userId}/admin`, { isAdmin: d.isAdmin })).json(),
    onSuccess: () => invalidateAll(),
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
  const addAdmin = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/admin/admins", { email });
      return res.json();
    },
    onSuccess: (data: any) => { invalidateAll(); setNewAdminEmail(""); toast({ title: "Admin aggiunto", description: data.email }); },
    onError: (e: any) => toast({ title: "Errore", description: e.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });
  const updateSettings = useMutation({
    mutationFn: async (showTestProfiles: boolean) => (await apiRequest("PATCH", "/api/admin/settings", { showTestProfiles })).json(),
    onSuccess: (data: any) => {
      invalidateAll();
      toast({
        title: "Impostazioni salvate",
        description: data.showTestProfiles ? "Profili test VISIBILI nell'app" : "Profili test NASCOSTI nell'app",
      });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile salvare", variant: "destructive" }),
  });
  const locationApproval = useMutation({
    mutationFn: async (d: { id: string; approved: boolean }) =>
      (await apiRequest("PATCH", `/api/admin/locations/${d.id}`, { approved: d.approved })).json(),
    onSuccess: () => invalidateAll(),
    onError: () => toast({ title: "Errore", description: "Impossibile aggiornare il luogo", variant: "destructive" }),
  });
  const deleteLocation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/admin/locations/${id}`)).json(),
    onSuccess: () => { invalidateAll(); toast({ title: "Luogo eliminato" }); },
    onError: () => toast({ title: "Errore", description: "Impossibile eliminare il luogo", variant: "destructive" }),
  });
  const deleteItem = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/admin/marketplace/${id}`)).json(),
    onSuccess: () => { invalidateAll(); toast({ title: "Annuncio eliminato" }); },
    onError: () => toast({ title: "Errore", description: "Impossibile eliminare l'annuncio", variant: "destructive" }),
  });
  const deleteService = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/admin/services/${id}`)).json(),
    onSuccess: () => { invalidateAll(); toast({ title: "Servizio eliminato" }); },
    onError: () => toast({ title: "Errore", description: "Impossibile eliminare il servizio", variant: "destructive" }),
  });
  const osmImport = useMutation({
    mutationFn: async (city: string) => (await apiRequest("POST", "/api/admin/import-osm-parks", { city })).json() as Promise<OsmImportResult>,
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: `Import ${data.city}`, description: `${data.imported} parchi importati (${data.skippedExisting} già presenti)` });
      setOsmCity("");
    },
    onError: (e: any) => toast({ title: "Errore import OSM", description: e.message, variant: "destructive" }),
  });

  if (!isLoading && !isAdmin) {
    setLocation("/");
    return null;
  }

  const handleLogout = async () => {
    try { await apiRequest("POST", "/api/auth/logout"); setLocation("/login"); }
    catch { toast({ title: "Errore", description: "Errore durante il logout", variant: "destructive" }); }
  };

  const handleUpload = async () => {
    if (!file || !category) {
      toast({ title: "Errore", description: "Seleziona file e categoria", variant: "destructive" });
      return;
    }
    setUploading(true); setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("csv", file); fd.append("category", category);
      const res = await fetch("/api/admin/upload-csv", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUploadResult(data); invalidateAll();
      toast({ title: "Caricamento completato", description: `${data.success} luoghi caricati` });
      setFile(null); setCategory("");
      const input = document.getElementById("csv-file") as HTMLInputElement;
      if (input) input.value = "";
    } catch {
      toast({ title: "Errore", description: "Errore durante il caricamento", variant: "destructive" });
    } finally { setUploading(false); }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }

  const testProfiles = adminUsers.filter((u) => u.profile?.isTestProfile);
  const filteredUsers = adminUsers.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    const name = u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.toLowerCase() : "";
    return u.email.toLowerCase().includes(q) || name.includes(q) || (u.profile?.location || "").toLowerCase().includes(q);
  });

  const TestVisibilityCard = (
    <Card className={settings?.showTestProfiles ? "border-green-300 bg-green-50/60" : "border-gray-200"}>
      <CardContent className="pt-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {settings?.showTestProfiles ? <Eye className="w-6 h-6 text-green-600 mt-0.5" /> : <EyeOff className="w-6 h-6 text-gray-400 mt-0.5" />}
          <div>
            <p className="font-semibold text-gray-900">Profili test visibili nell'app</p>
            <p className="text-sm text-gray-500 max-w-md">
              Attiva durante test/debug per vedere i {stats?.testProfiles ?? 0} profili test in scoperta e mappa.
              Disattiva quando l'app è live: gli utenti reali non li vedranno.
            </p>
            <p className={`text-sm font-medium mt-1 ${settings?.showTestProfiles ? "text-green-600" : "text-gray-500"}`}>
              Stato attuale: {settings?.showTestProfiles ? "VISIBILI" : "NASCOSTI"}
            </p>
          </div>
        </div>
        <Switch
          checked={settings?.showTestProfiles ?? true}
          onCheckedChange={(c) => updateSettings.mutate(c)}
          disabled={updateSettings.isPending || settings === undefined}
          data-testid="switch-show-test-profiles"
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="fixed inset-0 z-50 flex bg-gray-50 text-gray-900">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <img src={adminLogo} alt="HeyMama" className="h-8 w-auto object-contain" data-testid="admin-logo" />
            <span className="font-semibold text-sm text-gray-500">Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                section === key ? "bg-pink-50 text-pink-700" : "text-gray-600 hover:bg-gray-100"
              }`}
              data-testid={`nav-${key}`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {key === "test" && (stats?.testProfiles ?? 0) > 0 && (
                <span className="ml-auto text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{stats?.testProfiles}</span>
              )}
              {key === "locations" && (stats?.pendingLocations ?? 0) > 0 && (
                <span className="ml-auto text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">{stats?.pendingLocations}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <p className="px-2 text-xs text-gray-400 truncate mb-2">{user?.email}</p>
          <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/")} data-testid="button-open-app">
            <Home className="w-4 h-4 mr-2" /> Vai all'app
          </Button>
          <Button variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-50 mt-1" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="shrink-0 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold capitalize">{NAV.find((n) => n.key === section)?.label}</h1>
          {/* Mobile nav */}
          <div className="md:hidden">
            <Select value={section} onValueChange={(v) => setSection(v as SectionKey)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NAV.map((n) => <SelectItem key={n.key} value={n.key}>{n.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden text-red-600" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {/* DASHBOARD */}
          {section === "dashboard" && (
            <div className="space-y-6 max-w-6xl">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Utenti" value={stats?.users} />
                <StatCard icon={BadgeCheck} label="Verificati" value={stats?.verifiedUsers} />
                <StatCard icon={CreditCard} label="Abbonati" value={stats?.subscribedUsers} accent="text-green-600" />
                <StatCard icon={FlaskConical} label="Profili test" value={stats?.testProfiles} accent="text-amber-600" />
                <StatCard icon={MapPin} label="Luoghi" value={stats?.locations} />
                <StatCard icon={MapPin} label="Luoghi in attesa" value={stats?.pendingLocations} accent="text-orange-600" />
                <StatCard icon={ShoppingBag} label="Annunci market" value={stats?.marketplaceItems} />
                <StatCard icon={Wrench} label="Servizi" value={stats?.services} />
              </div>
              {TestVisibilityCard}
            </div>
          )}

          {/* USERS */}
          {section === "users" && (
            <div className="space-y-4 max-w-6xl">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Cerca per nome, email, città…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-10" data-testid="input-user-search" />
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="hidden md:table-cell">Città</TableHead>
                      <TableHead className="hidden md:table-cell">Abbonamento</TableHead>
                      <TableHead className="text-center">Admin</TableHead>
                      <TableHead className="text-center">Test</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                        <TableCell className="font-medium">
                          {u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() || "(vuoto)" : "(senza profilo)"}
                          {!u.isEmailVerified && <Badge variant="outline" className="ml-2 text-gray-400">non verif.</Badge>}
                        </TableCell>
                        <TableCell className="text-gray-500">{u.email}</TableCell>
                        <TableCell className="hidden md:table-cell text-gray-500">{u.profile?.location || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {u.subscriptionStatus === "active"
                            ? <Badge className="bg-green-100 text-green-700">attivo</Badge>
                            : <span className="text-gray-400 text-sm">{u.subscriptionStatus || "free"}</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={u.isAdmin}
                            disabled={u.isEnvAdmin || u.id === user?.id || setAdmin.isPending}
                            onCheckedChange={(c) => setAdmin.mutate({ userId: u.id, isAdmin: c })}
                            data-testid={`switch-admin-${u.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {u.profile ? (
                            <Switch
                              checked={u.profile.isTestProfile}
                              onCheckedChange={(c) => toggleTest.mutate({ profileId: u.profile!.id, isTestProfile: c })}
                              data-testid={`switch-test-${u.id}`}
                            />
                          ) : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {u.email !== "admin@claudio.com" && (
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
                              onClick={() => confirm(`Eliminare ${u.email}?`) && deleteUser.mutate(u.id)}
                              data-testid={`button-delete-user-${u.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Nessun utente</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* ADMINS */}
          {section === "admins" && (
            <div className="space-y-6 max-w-3xl">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Aggiungi amministratore</CardTitle>
                  <CardDescription>Inserisci l'email di un utente già registrato per dargli accesso admin.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@esempio.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newAdminEmail.trim() && addAdmin.mutate(newAdminEmail.trim())}
                    data-testid="input-new-admin-email"
                  />
                  <Button
                    onClick={() => newAdminEmail.trim() && addAdmin.mutate(newAdminEmail.trim())}
                    disabled={!newAdminEmail.trim() || addAdmin.isPending}
                    style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
                    data-testid="button-add-admin"
                  >
                    {addAdmin.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aggiungi"}
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Amministratori ({adminUsers.filter((u) => u.isAdmin).length})</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers.filter((u) => u.isAdmin).map((u) => (
                        <TableRow key={u.id} data-testid={`row-admin-${u.id}`}>
                          <TableCell className="font-medium">{u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() || "(vuoto)" : "—"}</TableCell>
                          <TableCell className="text-gray-500">{u.email}</TableCell>
                          <TableCell>
                            {u.isEnvAdmin
                              ? <Badge variant="outline" className="text-gray-500">env (fisso)</Badge>
                              : <Badge className="bg-pink-100 text-pink-700">dashboard</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            {u.isEnvAdmin ? (
                              <span className="text-xs text-gray-400">non modificabile</span>
                            ) : u.id === user?.id ? (
                              <span className="text-xs text-gray-400">tu</span>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                                onClick={() => confirm(`Rimuovere admin a ${u.email}?`) && setAdmin.mutate({ userId: u.id, isAdmin: false })}
                                data-testid={`button-remove-admin-${u.id}`}>
                                Rimuovi admin
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-gray-400 mt-3">Gli admin "env" sono definiti nella variabile ADMIN_EMAILS e restano admin a prescindere.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TEST PROFILES */}
          {section === "test" && (
            <div className="space-y-6 max-w-4xl">
              {TestVisibilityCard}
              <Card>
                <CardHeader>
                  <CardTitle>Azioni di massa</CardTitle>
                  <CardDescription>{stats?.testProfiles ?? testProfiles.length} profili attualmente marcati come test su {stats?.profiles ?? 0} totali. Le azioni qui sotto valgono per tutti.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => setAllTest.mutate(true)} disabled={setAllTest.isPending} data-testid="button-mark-all-test">
                    <FlaskConical className="w-4 h-4 mr-2" /> Marca TUTTI come test
                  </Button>
                  <Button variant="outline" onClick={() => confirm("Rimuovere il flag test da tutti i profili?") && setAllTest.mutate(false)} disabled={setAllTest.isPending} data-testid="button-unmark-all-test">
                    <XCircle className="w-4 h-4 mr-2" /> Rimuovi test da tutti
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Profili test ({testProfiles.length})</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead className="hidden md:table-cell">Città</TableHead><TableHead className="text-center">Test</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {testProfiles.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.profile?.firstName} {u.profile?.lastName}</TableCell>
                          <TableCell className="text-gray-500">{u.email}</TableCell>
                          <TableCell className="hidden md:table-cell text-gray-500">{u.profile?.location}</TableCell>
                          <TableCell className="text-center">
                            <Switch checked onCheckedChange={(c) => toggleTest.mutate({ profileId: u.profile!.id, isTestProfile: c })} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {testProfiles.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">Nessun profilo test</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* LOCATIONS */}
          {section === "locations" && (
            <div className="space-y-6 max-w-5xl">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><TreePine className="w-5 h-5" /> Import parchi da OpenStreetMap</CardTitle>
                    <CardDescription>Importa i parchi pubblici di una città (© OpenStreetMap, ODbL).</CardDescription></CardHeader>
                  <CardContent className="flex gap-2">
                    <Input placeholder="Città (es. Novara)" value={osmCity} onChange={(e) => setOsmCity(e.target.value)} disabled={osmImport.isPending} data-testid="input-osm-city" />
                    <Button onClick={() => osmCity.trim() && osmImport.mutate(osmCity.trim())} disabled={!osmCity.trim() || osmImport.isPending}
                      style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }} data-testid="button-import-osm">
                      {osmImport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importa"}
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Carica CSV</CardTitle>
                    <CardDescription>Colonne: nome, indirizzo, descrizione, link maps.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    <Input id="csv-file" type="file" accept=".csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setUploadResult(null); }} disabled={uploading} data-testid="input-csv-file" />
                    <div className="flex gap-2">
                      <Select value={category} onValueChange={setCategory} disabled={uploading}>
                        <SelectTrigger className="flex-1" data-testid="select-category"><SelectValue placeholder="Categoria…" /></SelectTrigger>
                        <SelectContent>{LOCATION_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button onClick={handleUpload} disabled={!file || !category || uploading} data-testid="button-upload-csv">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </Button>
                    </div>
                    {uploadResult && <p className="text-sm text-gray-500">{uploadResult.success} ok · {uploadResult.failed} errori</p>}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle>Luoghi ({adminLocations.length})</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="hidden md:table-cell">Categoria</TableHead><TableHead className="hidden md:table-cell">Indirizzo</TableHead><TableHead className="text-center">Stato</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {adminLocations.map((loc) => (
                        <TableRow key={loc.id} data-testid={`row-location-${loc.id}`}>
                          <TableCell className="font-medium">{loc.name}</TableCell>
                          <TableCell className="hidden md:table-cell text-gray-500">{loc.category}</TableCell>
                          <TableCell className="hidden md:table-cell text-gray-500 truncate max-w-[16rem]">{loc.address}</TableCell>
                          <TableCell className="text-center">
                            {loc.approved ? <Badge className="bg-green-100 text-green-700">approvato</Badge> : <Badge variant="outline" className="text-orange-600 border-orange-300">in attesa</Badge>}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button variant="ghost" size="icon" title={loc.approved ? "Nascondi" : "Approva"}
                              onClick={() => locationApproval.mutate({ id: loc.id, approved: !loc.approved })} data-testid={`button-approve-location-${loc.id}`}>
                              {loc.approved ? <EyeOff className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
                              onClick={() => confirm(`Eliminare "${loc.name}"?`) && deleteLocation.mutate(loc.id)} data-testid={`button-delete-location-${loc.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {adminLocations.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Nessun luogo</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* MARKETPLACE */}
          {section === "marketplace" && (
            <Card className="max-w-5xl">
              <CardHeader><CardTitle>Annunci ({adminItems.length})</CardTitle><CardDescription>Modera gli annunci del marketplace.</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Titolo</TableHead><TableHead className="hidden md:table-cell">Venditrice</TableHead><TableHead className="hidden md:table-cell">Categoria</TableHead><TableHead>Prezzo</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {adminItems.map((it) => (
                      <TableRow key={it.id} data-testid={`row-item-${it.id}`}>
                        <TableCell className="font-medium">{it.title}</TableCell>
                        <TableCell className="hidden md:table-cell text-gray-500">{it.sellerName}</TableCell>
                        <TableCell className="hidden md:table-cell text-gray-500 truncate max-w-[14rem]">{it.category}</TableCell>
                        <TableCell className="font-semibold" style={{ color: "var(--primary-pink)" }}>{eur(it.price)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
                            onClick={() => confirm(`Eliminare "${it.title}"?`) && deleteItem.mutate(it.id)} data-testid={`button-delete-item-${it.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {adminItems.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Nessun annuncio</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* SERVICES */}
          {section === "services" && (
            <Card className="max-w-5xl">
              <CardHeader><CardTitle>Servizi ({adminServices.length})</CardTitle><CardDescription>Modera i servizi offerti dagli utenti.</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Titolo</TableHead><TableHead className="hidden md:table-cell">Fornitrice</TableHead><TableHead className="hidden md:table-cell">Tipo</TableHead><TableHead>Tariffa</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {adminServices.map((s) => (
                      <TableRow key={s.id} data-testid={`row-service-${s.id}`}>
                        <TableCell className="font-medium">{s.title}</TableCell>
                        <TableCell className="hidden md:table-cell text-gray-500">{s.providerName}</TableCell>
                        <TableCell className="hidden md:table-cell text-gray-500">{s.serviceType}</TableCell>
                        <TableCell>{s.hourlyRate ? `${eur(s.hourlyRate)}/h` : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
                            onClick={() => confirm(`Eliminare "${s.title}"?`) && deleteService.mutate(s.id)} data-testid={`button-delete-service-${s.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {adminServices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">Nessun servizio</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* SETTINGS */}
          {section === "settings" && (
            <div className="space-y-6 max-w-3xl">
              {TestVisibilityCard}
              <Card>
                <CardHeader><CardTitle>Informazioni</CardTitle></CardHeader>
                <CardContent className="text-sm text-gray-500 space-y-1">
                  <p>Admin: <span className="font-medium text-gray-700">{user?.email}</span></p>
                  <p>Le impostazioni sono globali e valgono per tutti gli utenti dell'app.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Home; label: string; value?: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-gray-400 mb-1">
          <Icon className="w-4 h-4" />
          <span className="text-sm">{label}</span>
        </div>
        <p className={`text-3xl font-bold ${accent || "text-gray-900"}`}>{value ?? "–"}</p>
      </CardContent>
    </Card>
  );
}
