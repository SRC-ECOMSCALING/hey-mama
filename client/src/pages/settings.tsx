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
import { Trash2, Loader2, Ban, Bell, Eye, UserCircle, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Language } from "@/lib/translations";
import { apiRequest } from "@/lib/queryClient";
import { setToken, isNative } from "@/lib/config";
import { PUSH_ENABLED, enablePush, disablePush } from "@/lib/push";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/app-header";
import type { Block, Profile } from "@shared/schema";

interface BlockWithProfile extends Block {
  profile: Profile | null;
}

const PUSH_PREF_KEY = "heymama.push";

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, logout, isLoggingOut } = useAuth();

  // Push: a device preference (the token lives on the server). Only the
  // native app can receive push; the web shows an explanation instead.
  const [pushOn, setPushOn] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(PUSH_PREF_KEY) === "on",
  );
  const [pushBusy, setPushBusy] = useState(false);
  const pushAvailable = PUSH_ENABLED && user?.pushConfigured !== false;

  const handlePushToggle = async (checked: boolean) => {
    setPushBusy(true);
    try {
      if (checked) {
        const outcome = await enablePush();
        if (outcome === "granted") {
          setPushOn(true);
          localStorage.setItem(PUSH_PREF_KEY, "on");
        } else {
          setPushOn(false);
          localStorage.setItem(PUSH_PREF_KEY, "off");
          toast({
            title: t("pushNotificationsLabel"),
            description: outcome === "denied" ? t("pushPermissionDenied") : t("pushNotConfigured"),
          });
        }
      } else {
        await disablePush();
        setPushOn(false);
        localStorage.setItem(PUSH_PREF_KEY, "off");
      }
    } finally {
      setPushBusy(false);
    }
  };

  // Privacy: hide "active today / this week" and the online dot from others
  const showActivity = user?.showActivity !== false;
  const updateActivityPref = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await apiRequest("PATCH", "/api/users/me/preferences", { showActivity: value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: () => {
      toast({ title: t("error"), description: t("somethingWentWrong"), variant: "destructive" });
    },
  });

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

        {/* Notifications + privacy */}
        <Card data-testid="card-device-settings">
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="push" className="font-medium text-gray-900">
                  {t("pushNotificationsLabel")}
                </Label>
                <p className="text-sm text-gray-500">{t("pushNotificationsDescription")}</p>
                {!isNative ? (
                  <p className="text-xs text-gray-400 mt-1">{t("pushWebOnly")}</p>
                ) : !pushAvailable ? (
                  <p className="text-xs text-gray-400 mt-1">{t("pushNotConfigured")}</p>
                ) : null}
              </div>
              <Switch
                id="push"
                checked={pushOn}
                disabled={!isNative || !pushAvailable || pushBusy}
                onCheckedChange={handlePushToggle}
                className="shrink-0"
                data-testid="switch-push"
              />
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="show-activity" className="font-medium text-gray-900">
                  {t("showActivityLabel")}
                </Label>
                <p className="text-sm text-gray-500">{t("showActivityDescription")}</p>
              </div>
              <Switch
                id="show-activity"
                checked={showActivity}
                disabled={updateActivityPref.isPending || !user}
                onCheckedChange={(c) => updateActivityPref.mutate(c)}
                className="shrink-0"
                data-testid="switch-show-activity"
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
            <Link href="/terms" className="text-sm text-pink-600 hover:text-pink-700 underline" data-testid="link-settings-terms">{t("termsOfUse")}</Link>
            <Link href="/privacy" className="text-sm text-pink-600 hover:text-pink-700 underline" data-testid="link-settings-privacy">{t("privacyPolicy")}</Link>
            <Link href="/support" className="text-sm text-pink-600 hover:text-pink-700 underline" data-testid="link-settings-support">{t("support")}</Link>
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
