import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

// Blocking modal shown to authenticated users who haven't yet accepted the
// Terms of Use + Privacy Policy (e.g. accounts created before this feature).
// Hidden on the legal pages so the user can actually read them before accepting.
export default function TermsGate() {
  const { isAuthenticated, termsAccepted } = useAuth();
  const { t } = useLanguage();
  const [location, setLocation] = useLocation();
  const [checked, setChecked] = useState(false);
  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/accept-terms");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const onLegalPage = location === "/privacy" || location === "/terms";

  // termsAccepted is undefined while /api/auth/me is loading; only gate once
  // we positively know it's false.
  if (!isAuthenticated || termsAccepted !== false || onLegalPage) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#17111F]/45 px-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pt-4 backdrop-blur-[3px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-title"
    >
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_24px_60px_rgba(23,17,31,0.25)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 text-pink-500" aria-hidden="true">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h2 id="terms-gate-title" className="mb-2 text-center font-display text-xl font-semibold text-gray-900" data-testid="text-terms-gate-title">
          {t("termsGateTitle")}
        </h2>
        <p className="mb-4 text-pretty text-center text-sm leading-relaxed text-gray-600">
          {t("termsGateBody")}
        </p>

        <div className="mb-4 flex items-center justify-center gap-5 text-sm">
          <button
            type="button"
            onClick={() => setLocation("/terms")}
            className="min-h-11 font-semibold text-pink-700 underline"
            data-testid="link-view-terms"
          >
            {t("termsOfUse")}
          </button>
          <button
            type="button"
            onClick={() => setLocation("/privacy")}
            className="min-h-11 font-semibold text-pink-700 underline"
            data-testid="link-view-privacy"
          >
            {t("privacyPolicy")}
          </button>
        </div>

        <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-gray-50 p-4">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            className="mt-0.5 bg-white"
            data-testid="checkbox-accept-terms"
          />
          <span className="text-sm leading-relaxed text-gray-800">{t("acceptTermsLabel")}</span>
        </label>

        <Button
          size="lg"
          className="w-full"
          disabled={!checked || acceptMutation.isPending}
          onClick={() => acceptMutation.mutate()}
          data-testid="button-accept-terms"
        >
          {acceptMutation.isPending ? t("loading") : t("acceptAndContinue")}
        </Button>
      </div>
    </div>
  );
}
