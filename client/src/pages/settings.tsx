import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Loader2, Ban } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Language } from "@/lib/translations";
import { apiRequest } from "@/lib/queryClient";
import { setToken } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import type { Block, Profile } from "@shared/schema";

interface BlockWithProfile extends Block {
  profile: Profile | null;
}

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 safe-top">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/profile">
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">{t("settingsTitle")}</h1>
        </div>
      </div>

      {/* Settings Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Card data-testid="card-language-settings">
          <CardHeader>
            <CardTitle>{t("languagePreference")}</CardTitle>
            <CardDescription>{t("selectLanguage")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="language">{t("languagePreference")}</Label>
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
            </div>
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
                    <span className="flex-1 text-sm font-medium text-gray-800">
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
              <AlertDialogContent>
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
