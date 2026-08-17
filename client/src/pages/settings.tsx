import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2, Ban, Bell, MapPin, UserCircle, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Language } from "@/lib/translations";
import { apiRequest } from "@/lib/queryClient";
import { setToken } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/app-header";
import type { Block, Profile } from "@shared/schema";

interface BlockWithProfile extends Block {
  profile: Profile | null;
}

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logout, isLoggingOut } = useAuth();

  // Device preferences (stored locally, come from the old settings popup)
  const [notifications, setNotifications] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("notifications") !== "disabled",
  );
  const [geolocation, setGeolocation] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("geolocation") === "enabled",
  );

  const handleNotificationToggle = async (checked: boolean) => {
    if (checked && "Notification" in window) {
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      setNotifications(granted);
      localStorage.setItem("notifications", granted ? "enabled" : "disabled");
    } else {
      setNotifications(false);
      localStorage.setItem("notifications", "disabled");
    }
  };

  const handleGeolocationToggle = (checked: boolean) => {
    if (checked && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeolocation(true);
          localStorage.setItem("geolocation", "enabled");
          localStorage.setItem("latitude", position.coords.latitude.toString());
          localStorage.setItem("longitude", position.coords.longitude.toString());
        },
        () => {
          setGeolocation(false);
          localStorage.setItem("geolocation", "disabled");
        },
      );
    } else {
      setGeolocation(false);
      localStorage.setItem("geolocation", "disabled");
      localStorage.removeItem("latitude");
      localStorage.removeItem("longitude");
    }
  };

  const { data: blockedUsers = [] } = useQuery<BlockWithProfile[]>({
    queryKey: ["/api/blocks"],
  });

  const unblock = useMutation({
    mutationFn: async (blockedUserId: string) => {
      const res = await apiRequest("DELETE", `/api/blocks/${blockedUserId}`);
      return res.json();
    },
    onSuccess: () => {
      // Refetch everything so the unblocked user's content reappears
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({ title: t("error"), description: t("somethingWentWrong"), variant: "destructive" });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/auth/account");
      return res.json();
    },
    onSuccess: () => {
      setToken(null);
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      toast({ title: t("accountDeleted") });
      setLocation("/login");
    },
    onError: () => {
      toast({ title: t("error"), description: t("somethingWentWrong"), variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <AppHeader backTo="history" />

      {/* Settings Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-settings-title">
          {t("settingsTitle")}
        </h1>

        {/* Account */}
        <Card data-testid="card-account">
          <CardContent className="pt-6 space-y-1">
            <button
              onClick={() => setLocation("/profile")}
              className="w-full flex items-center gap-3 py-3 text-left rounded-xl px-2 hover:bg-gray-50 transition-colors"
              data-testid="button-open-profile"
            >
              <UserCircle className="h-5 w-5 text-pink-500 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-gray-900">{t("profile")}</span>
                <span className="block text-sm text-gray-500 truncate">{t("viewProfile")}</span>
              </span>
            </button>
            <Separator />
            <button
              onClick={logout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 py-3 text-left rounded-xl px-2 hover:bg-red-50 transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5 text-red-500 shrink-0" />
              <span className="font-medium text-red-600">
                {isLoggingOut ? t("loggingOut") : t("logout")}
              </span>
            </button>
          </CardContent>
        </Card>

        {/* Device preferences */}
        <Card data-testid="card-device-settings">
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="notifications" className="font-medium text-gray-900">
                  Notifiche
                </Label>
                <p className="text-sm text-gray-500">Avvisi per nuove connessioni e messaggi</p>
              </div>
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={handleNotificationToggle}
                className="shrink-0"
              />
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="geolocation" className="font-medium text-gray-900">
                  Servizi di localizzazione
                </Label>
                <p className="text-sm text-gray-500">Trova mamme e luoghi vicino a te</p>
              </div>
              <Switch
                id="geolocation"
                checked={geolocation}
                onCheckedChange={handleGeolocationToggle}
                className="shrink-0"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-language-settings">
          <CardHeader>
            <CardTitle>{t("languagePreference")}</CardTitle>
            <CardDescription>{t("selectLanguage")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={language}
              onValueChange={(value) => setLanguage(value as Language)}
            >
              <SelectTrigger id="language" data-testid="select-language">
                <SelectValue placeholder={t("selectLanguage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en" data-testid="option-english">{t("english")}</SelectItem>
                <SelectItem value="it" data-testid="option-italian">{t("italian")}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Blocked users (App Store 1.2) */}
        <Card data-testid="card-blocked-users">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              {t("blockedUsers")}
            </CardTitle>
            <CardDescription>{t("blockedUsersDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {blockedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-blocked-users">
                {t("noBlockedUsers")}
              </p>
            ) : (
              <div className="space-y-3">
                {blockedUsers.map((b) => (
                  <div key={b.id} className="flex items-center gap-3" data-testid={`row-blocked-${b.blockedId}`}>
                    <img
                      src={b.profile?.photoUrls?.[0] || "https://via.placeholder.com/80"}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                      {b.profile ? `${b.profile.firstName} ${b.profile.lastName}`.trim() : "—"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblock.mutate(b.blockedId)}
                      disabled={unblock.isPending}
                      data-testid={`button-unblock-${b.blockedId}`}
                    >
                      {t("unblock")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legal */}
        <Card>
          <CardHeader>
            <CardTitle>{t("legal")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/terms"><a className="text-sm text-pink-600 hover:text-pink-700 underline" data-testid="link-settings-terms">{t("termsOfUse")}</a></Link>
            <Link href="/privacy"><a className="text-sm text-pink-600 hover:text-pink-700 underline" data-testid="link-settings-privacy">{t("privacyPolicy")}</a></Link>
            <Link href="/support"><a className="text-sm text-pink-600 hover:text-pink-700 underline" data-testid="link-settings-support">Supporto</a></Link>
          </CardContent>
        </Card>

        {/* Danger zone: account deletion */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">{t("deleteAccount")}</CardTitle>
            <CardDescription>{t("deleteAccountDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" data-testid="button-delete-account">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("deleteAccount")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteAccountConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("deleteAccountConfirmDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => deleteAccount.mutate()}
                    disabled={deleteAccount.isPending}
                    data-testid="button-confirm-delete-account"
                  >
                    {deleteAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("deleteAccountConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
