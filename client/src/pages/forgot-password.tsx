import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import heyMamaSymbol from "@assets/heymama-symbol.png";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/translations";

// Two steps on one page: ask for the email, then enter the emailed 6-digit
// code together with the new password.
type Step = "email" | "code";

// apiRequest throws "<status>: <json body>"; the body carries a `code` so the
// message can be shown in the user's language instead of the server's.
const ERROR_KEYS: Record<string, TranslationKey> = {
  invalid_email: "resetInvalidEmail",
  email_failed: "resetEmailFailed",
  invalid_code_format: "invalidResetCode",
  password_too_short: "passwordTooShort",
  invalid_code: "resetInvalidCode",
  expired_code: "resetExpiredCode",
};

function errorKey(error: unknown): TranslationKey {
  const message = error instanceof Error ? error.message : "";
  try {
    const body = JSON.parse(message.replace(/^\d+:\s*/, ""));
    const key = body && typeof body.code === "string" ? ERROR_KEYS[body.code] : undefined;
    if (key) return key;
  } catch {
    /* non-JSON body */
  }
  return "somethingWentWrong";
}

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const requestCode = useMutation({
    mutationFn: async (targetEmail: string) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email: targetEmail });
      return res.json();
    },
    onSuccess: () => {
      setStep("code");
      toast({ title: t("codeSentTitle"), description: t("codeSentSubtitle") });
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: t(errorKey(error)),
        variant: "destructive",
      });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        email,
        code,
        newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("passwordResetDone"), description: t("passwordResetDoneHint") });
      setLocation("/login");
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: t(errorKey(error)),
        variant: "destructive",
      });
    },
  });

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    requestCode.mutate(email.trim());
  };

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast({ title: t("invalidResetCode"), variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: t("passwordTooShort"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("passwordsDoNotMatch"), variant: "destructive" });
      return;
    }
    resetPassword.mutate();
  };

  return (
    <div className="safe-page min-h-screen bg-gray-50 px-5">
      <div className="mx-auto flex w-full max-w-md flex-col gap-7">
        <Link href="/login" className="icon-btn" aria-label={t("backToLogin")} data-testid="link-back-to-login">
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="flex flex-col gap-2.5">
          <img src={heyMamaSymbol} alt="HeyMama" className="mb-2 h-14 w-14 object-contain" />
          <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-gray-900">
            {t("forgotPasswordTitle")}
          </h1>
          <p className="text-pretty text-base leading-normal text-gray-600">
            {step === "email" ? t("forgotPasswordSubtitle") : t("codeSentSubtitle")}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={submitEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t("email")}</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("enterYourEmail")}
                data-testid="input-reset-email"
              />
            </div>
            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={requestCode.isPending}
                data-testid="button-send-code"
              >
                {requestCode.isPending ? t("sendingCode") : t("sendCode")}
              </Button>
            </div>
            {/* For someone who already has the code and reopened the app */}
            <button
              type="button"
              className="mx-auto flex min-h-11 items-center text-sm font-semibold text-pink-700"
              onClick={() => {
                if (!email.trim()) {
                  toast({ title: t("enterYourEmail"), variant: "destructive" });
                  return;
                }
                setStep("code");
              }}
              data-testid="button-have-code"
            >
              {t("alreadyHaveCode")}
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-code">{t("resetCode")}</Label>
              <Input
                id="reset-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="h-14 text-center font-display text-2xl tracking-[0.5em]"
                data-testid="input-reset-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("newPassword")}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-12"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-600"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  aria-pressed={showPassword}
                  data-testid="button-toggle-new-password"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">{t("confirmNewPassword")}</Label>
              <Input
                id="confirm-new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-new-password"
              />
            </div>
            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={resetPassword.isPending}
                data-testid="button-reset-password"
              >
                {resetPassword.isPending ? t("resettingPassword") : t("resetPasswordAction")}
              </Button>
            </div>
            <button
              type="button"
              className="mx-auto flex min-h-11 items-center text-sm font-semibold text-pink-700 disabled:opacity-50"
              onClick={() => requestCode.mutate(email)}
              disabled={requestCode.isPending}
              data-testid="button-resend-code"
            >
              {t("resendCode")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
