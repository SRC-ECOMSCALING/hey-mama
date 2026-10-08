import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import { useLanguage } from "@/contexts/LanguageContext";

// Two steps on one page: ask for the email, then enter the emailed 6-digit
// code together with the new password.
type Step = "email" | "code";

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
        description: error?.message?.replace(/^\d+:\s*/, "") || t("somethingWentWrong"),
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
        description: error?.message?.replace(/^\d+:\s*/, "") || t("somethingWentWrong"),
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={heyMamaLogo} alt="HeyMama" className="h-12 mx-auto mb-4 object-contain" />
          <CardTitle>{t("forgotPasswordTitle")}</CardTitle>
          <CardDescription>
            {step === "email" ? t("forgotPasswordSubtitle") : t("codeSentSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                disabled={requestCode.isPending}
                data-testid="button-send-code"
              >
                {requestCode.isPending ? t("sendingCode") : t("sendCode")}
              </Button>
              {/* For someone who already has the code and reopened the app */}
              <Button
                type="button"
                variant="link"
                className="w-full text-sm text-pink-600 hover:text-pink-700"
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
              </Button>
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
                  className="text-center text-2xl tracking-[0.5em]"
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
                    data-testid="input-new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword((v) => !v)}
                    data-testid="button-toggle-new-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
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
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                disabled={resetPassword.isPending}
                data-testid="button-reset-password"
              >
                {resetPassword.isPending ? t("resettingPassword") : t("resetPasswordAction")}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full text-sm text-pink-600 hover:text-pink-700"
                onClick={() => requestCode.mutate(email)}
                disabled={requestCode.isPending}
                data-testid="button-resend-code"
              >
                {t("resendCode")}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/login">
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto text-sm font-medium text-pink-600 hover:text-pink-700"
                data-testid="link-back-to-login"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t("backToLogin")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
