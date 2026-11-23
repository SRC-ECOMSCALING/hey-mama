import { useState, type ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2, Ban, Bell, ChevronRight, Eye, Globe, LogOut } from "lucide-react";
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

// One row of a settings card; rows are separated by hairlines.
const ROW = "flex w-full items-center gap-3 border-b border-gray-100 text-left last:border-0";
const ROW_LABEL = "text-[15px] font-semibold leading-tight text-gray-900";

function IconTile({ tone = "pink", children }: { tone?: "pink" | "violet"; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px] ${
        tone === "pink" ? "bg-pink-50 text-pink-700" : "bg-purple-50 text-purple-700"
      }`}
    >
      {children}
    </span>
  );
}

function Group({ id, title, children, testId }: { id: string; title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="space-y-2" aria-labelledby={id}>
      <h2 id={id} className="section-label font-sans tracking-normal">{title}</h2>
      <div className="card-float px-4" data-testid={testId}>{children}</div>
    </section>
  );
}

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, logout, isLoggingOut } = useAuth();
  const [blockedOpen, setBlockedOpen] = useState(false);

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
    <div className="min-h-screen bg-gray-50 pb-10">
      <AppHeader title={t("settingsTitle")} right={null} />

      <main className="mx-auto max-w-2xl space-y-[18px] px-5 pt-1">
        {/* Notifications + presence */}
        <Group id="settings-notifications" title={t("settingsGroupNotifications")} testId="card-device-settings">
          <div className={`${ROW} min-h-[60px] py-3`}>
            <IconTile><Bell /></IconTile>
            <div className="min-w-0 flex-1">
              <Label htmlFor="push" className={ROW_LABEL}>
                {t("pushNotificationsLabel")}
              </Label>
              <p className="mt-1 text-xs leading-snug text-gray-600">{t("pushNotificationsDescription")}</p>
              {!isNative ? (
                <p className="mt-1 text-xs leading-snug text-gray-500">{t("pushWebOnly")}</p>
              ) : !pushAvailable ? (
                <p className="mt-1 text-xs leading-snug text-gray-500">{t("pushNotConfigured")}</p>
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
          <div className={`${ROW} min-h-[60px] py-3`}>
            <IconTile><Eye /></IconTile>
            <div className="min-w-0 flex-1">
              <Label htmlFor="show-activity" className={ROW_LABEL}>
                {t("showActivityLabel")}
              </Label>
              <p className="mt-1 text-xs leading-snug text-gray-600">{t("showActivityDescription")}</p>
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
        </Group>

        {/* Preferences */}
        <Group id="settings-preferences" title={t("settingsGroupPreferences")}>
          <div className={`${ROW} min-h-[54px] py-1`} data-testid="card-language-settings">
            <IconTile tone="violet"><Globe /></IconTile>
            <Label htmlFor="language" className={`${ROW_LABEL} flex-1`}>
              {t("settingsLanguage")}
            </Label>
            <Select
              value={language}
              onValueChange={(value) => setLanguage(value as Language)}
            >
              <SelectTrigger
                id="language"
                className="-mr-2 h-11 w-auto gap-1.5 border-0 bg-transparent px-2 text-sm font-medium text-gray-600 focus:ring-offset-0"
                data-testid="select-language"
              >
                <SelectValue placeholder={t("selectLanguage")} />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="en" data-testid="option-english">{t("english")}</SelectItem>
                <SelectItem value="it" data-testid="option-italian">{t("italian")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Blocked users (App Store 1.2) */}
          <button
            type="button"
            className={`${ROW} min-h-[54px] py-1`}
            onClick={() => setBlockedOpen(true)}
            aria-haspopup="dialog"
            data-testid="button-blocked-users"
          >
            <IconTile tone="violet"><Ban /></IconTile>
            <span className={`${ROW_LABEL} flex-1`}>{t("blockedUsers")}</span>
            <span className="text-sm font-medium text-gray-600" data-testid="text-blocked-count">{blockedUsers.length}</span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-500" aria-hidden="true" />
          </button>
        </Group>

        {/* Help and legal */}
        <Group id="settings-help" title={t("settingsGroupHelp")}>
          <Link href="/support" className={`${ROW} min-h-[54px] py-1`} data-testid="link-settings-support">
            <span className={`${ROW_LABEL} flex-1`}>{t("settingsSupportFaq")}</span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-500" aria-hidden="true" />
          </Link>
          <Link href="/privacy" className={`${ROW} min-h-[54px] py-1`} data-testid="link-settings-privacy">
            <span className={`${ROW_LABEL} flex-1`}>{t("privacyPolicy")}</span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-500" aria-hidden="true" />
          </Link>
          <Link href="/terms" className={`${ROW} min-h-[54px] py-1`} data-testid="link-settings-terms">
            <span className={`${ROW_LABEL} flex-1`}>{t("termsOfUse")}</span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-500" aria-hidden="true" />
          </Link>
        </Group>

        {/* Account: logout and deletion */}
        <Group id="settings-account" title={t("settingsGroupAccount")} testId="card-account">
          <button
            type="button"
            onClick={logout}
            disabled={isLoggingOut}
            className={`${ROW} min-h-[54px] py-1 disabled:opacity-50`}
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5 shrink-0 text-gray-900" strokeWidth={1.9} aria-hidden="true" />
            <span className={`${ROW_LABEL} flex-1`}>{isLoggingOut ? t("loggingOut") : t("logout")}</span>
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className={`${ROW} min-h-[54px] py-1 text-destructive`} data-testid="button-delete-account">
                <Trash2 className="h-5 w-5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                <span className="flex-1 text-[15px] font-semibold leading-tight">{t("deleteAccount")}</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteAccountConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteAccountConfirmDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={() => deleteAccount.mutate()}
                  disabled={deleteAccount.isPending}
                  data-testid="button-confirm-delete-account"
                >
                  {deleteAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("deleteAccountConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Group>
      </main>

      {/* Blocked users: list and unblock */}
      <Drawer open={blockedOpen} onOpenChange={setBlockedOpen} shouldScaleBackground={false}>
        <DrawerContent data-testid="card-blocked-users">
          <DrawerHeader className="px-5 pt-5 text-left">
            <DrawerTitle>{t("blockedUsers")}</DrawerTitle>
            <DrawerDescription className="text-gray-600">{t("blockedUsersDescription")}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))]">
            {blockedUsers.length === 0 ? (
              <p className="py-4 text-sm text-gray-600" data-testid="text-no-blocked-users">
                {t("noBlockedUsers")}
              </p>
            ) : (
              <div>
                {blockedUsers.map((b) => {
                  const name = b.profile ? `${b.profile.firstName} ${b.profile.lastName}`.trim() : "—";
                  const photo = b.profile?.photoUrls?.[0];
                  return (
                    <div key={b.id} className="flex items-center gap-3 border-b border-gray-100 py-3.5 last:border-0" data-testid={`row-blocked-${b.blockedId}`}>
                      {photo ? (
                        <img src={photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-100 font-display text-base font-semibold text-gray-900" aria-hidden="true">
                          {name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900">{name}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-11"
                        onClick={() => unblock.mutate(b.blockedId)}
                        disabled={unblock.isPending}
                        data-testid={`button-unblock-${b.blockedId}`}
                      >
                        {t("unblock")}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
