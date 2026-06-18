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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}>
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-center text-gray-900 mb-2" data-testid="text-terms-gate-title">
          {t("termsGateTitle")}
        </h2>
        <p className="text-sm text-gray-600 text-center mb-5">
          {t("termsGateBody")}
        </p>

        <div className="flex items-center justify-center gap-4 mb-5 text-sm">
          <button
            onClick={() => setLocation("/terms")}
            className="font-medium text-pink-600 hover:text-pink-700 underline"
            data-testid="link-view-terms"
          >
            {t("termsOfUse")}
          </button>
          <span className="text-gray-300">·</span>
          <button
            onClick={() => setLocation("/privacy")}
            className="font-medium text-pink-600 hover:text-pink-700 underline"
            data-testid="link-view-privacy"
          >
            {t("privacyPolicy")}
          </button>
        </div>

        <label className="flex items-start gap-3 mb-5 cursor-pointer">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            className="mt-0.5"
            data-testid="checkbox-accept-terms"
          />
          <span className="text-sm text-gray-700">{t("acceptTermsLabel")}</span>
        </label>

        <Button
          className="w-full h-12 rounded-2xl text-base font-semibold text-white"
          style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
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
