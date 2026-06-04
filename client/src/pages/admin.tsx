import { useState } from "react";
import { useLocation } from "wouter";
import { Upload, MapPin, CheckCircle, XCircle, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface UploadResult {
  success: number;
  failed: number;
  errors: string[];
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
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect if not admin
  if (!isLoading && (!user || user.email !== "admin@claudio.com")) {
    setLocation("/");
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Errore",
          description: "Per favore carica un file CSV",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      
      toast({
        title: "Logout effettuato",
        description: "Sei stato disconnesso con successo",
      });
      
      setLocation("/login");
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore durante il logout",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Errore",
        description: "Seleziona un file CSV",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "Errore",
        description: "Seleziona una categoria",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);
      formData.append('category', category);

      const response = await fetch('/api/admin/upload-csv', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setResult(data);

      toast({
        title: "Caricamento completato",
        description: `${data.success} locations caricate con successo come "${LOCATION_CATEGORIES.find(c => c.value === category)?.label}"`,
      });

      // Reset file input and category
      setFile(null);
      setCategory("");
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento del CSV",
        variant: "destructive",
      });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Admin Panel
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Carica locations tramite file CSV
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
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  File selezionato: {file.name}
                </p>
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
              {category && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Tutti i luoghi saranno caricati come: {LOCATION_CATEGORIES.find(c => c.value === category)?.label}
                </p>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2 text-sm sm:text-base">
                <MapPin className="w-4 h-4 shrink-0" />
                Formato CSV Richiesto
              </h3>
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 mb-2">
                Il file CSV deve avere le seguenti colonne (senza intestazione):
              </p>
              <ul className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
                <li><strong>Nome:</strong> Nome della location</li>
                <li><strong>Indirizzo:</strong> Indirizzo completo con città</li>
                <li><strong>Descrizione:</strong> Descrizione della location</li>
                <li><strong>Link Google Maps:</strong> URL di Google Maps (opzionale, lasciare vuoto se non disponibile)</li>
              </ul>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 break-words">
                Esempio: "Parco Giochi ABC,Via Roma 123 Milano,Bellissimo parco per bambini,https://maps.app.goo.gl/xyz"
              </p>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || !category || uploading}
              className="w-full"
              style={{
                background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))",
              }}
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
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Successo</p>
                          <p className="text-2xl font-bold text-green-600" data-testid="text-success-count">
                            {result.success}
                          </p>
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
                          <p className="text-2xl font-bold text-red-600" data-testid="text-failed-count">
                            {result.failed}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {result.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4">
                    <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2 text-sm sm:text-base">
                      Errori riscontrati:
                    </h3>
                    <ul className="text-xs sm:text-sm text-red-700 dark:text-red-300 space-y-1 max-h-60 overflow-y-auto">
                      {result.errors.map((error, index) => (
                        <li key={index} className="list-disc list-inside break-words">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6">
          <Button
            variant="outline"
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
          >
            Torna alla Home
          </Button>
        </div>
      </div>
    </div>
  );
}
