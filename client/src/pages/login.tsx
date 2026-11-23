import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { loginSchema, type Login } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, CalendarDays, Coffee, Eye, EyeOff, Heart, MessageCircle, ShoppingBag } from "lucide-react";
import heyMamaSymbol from "@assets/heymama-symbol.png";
import { useLanguage } from "@/contexts/LanguageContext";

// The welcome screen is shown once per device: returning users (and anyone
// coming back from registration or a logout) land straight on the form.
const SEEN_WELCOME_KEY = "heymama.seenWelcome";

function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(SEEN_WELCOME_KEY) !== null;
  } catch {
    return false;
  }
}

export default function Login() {
  const [view, setView] = useState<"welcome" | "form">(() => (hasSeenWelcome() ? "form" : "welcome"));
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  useEffect(() => {
    try {
      localStorage.setItem(SEEN_WELCOME_KEY, "1");
    } catch {
      /* storage unavailable: the welcome simply shows again next time */
    }
  }, []);

  const form = useForm<Login>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: Login) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate auth query to refresh user state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });

      toast({
        title: t("welcomeBack"),
        description: t("loginSuccess"),
      });

      // Small delay to ensure auth state updates before redirect
      setTimeout(() => {
        // Redirect admin to admin page
        if (data.user?.email === "admin@claudio.com") {
          setLocation("/admin");
        } else {
          setLocation("/");
        }
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: t("loginFailed"),
        description: error.message.startsWith("401:")
          ? t("invalidCredentials")
          : t("somethingWentWrong"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Login) => {
    loginMutation.mutate(data);
  };

  // EULA / Terms presented before login (App Store 1.2)
  const termsNotice = (
    <p className="text-center text-xs leading-relaxed text-gray-600" data-testid="text-login-terms-notice">
      {t("byContinuingAgree")}{" "}
      <Link href="/terms" className="font-medium text-pink-700 underline" data-testid="link-terms">
        {t("termsOfUse")}
      </Link>{" "}
      {t("and")}{" "}
      <Link href="/privacy" className="font-medium text-pink-700 underline" data-testid="link-privacy">
        {t("privacyPolicy")}
      </Link>
    </p>
  );

  // ---------- Welcome ----------
  if (view === "welcome") {
    return (
      <div className="safe-page relative flex min-h-screen flex-col overflow-hidden bg-gray-50 px-6" data-testid="view-welcome">
        {/* Decoration: rings around the logo, a few tinted discs sitting on them.
            Everything is positioned from the centre of this area. */}
        <div className="relative min-h-[330px] flex-1" aria-hidden="true">
          <div className="absolute left-1/2 top-[54%] h-0 w-0">
            <svg width="520" height="520" viewBox="0 0 520 520" className="absolute -left-[260px] -top-[260px] max-w-none">
              <circle cx="260" cy="260" r="70" fill="none" stroke="var(--magenta)" strokeOpacity="0.34" strokeWidth="1.5" />
              <circle cx="260" cy="260" r="130" fill="none" stroke="var(--magenta)" strokeOpacity="0.26" strokeWidth="1.5" />
              <circle cx="260" cy="260" r="190" fill="none" stroke="var(--magenta)" strokeOpacity="0.18" strokeWidth="1.5" />
              <circle cx="260" cy="260" r="250" fill="none" stroke="var(--magenta)" strokeOpacity="0.12" strokeWidth="1.5" />
            </svg>

            <span className="absolute -left-12 -top-12 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-[0_0_0_10px_rgba(255,255,255,0.55),0_14px_34px_rgba(216,27,114,0.28)]">
              <img src={heyMamaSymbol} alt="" className="h-[60px] w-[60px] object-contain" />
            </span>

            <span className="absolute left-[91px] top-[-87px] flex h-11 w-11 items-center justify-center rounded-full bg-pink-100 text-gray-900 shadow-[0_0_0_3px_#F6F5F7,0_0_0_5px_#D81B72]">
              <Heart className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="absolute left-[-135px] top-[43px] flex h-11 w-11 items-center justify-center rounded-full bg-purple-100 text-gray-900 shadow-[0_0_0_3px_#F6F5F7]">
              <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="absolute left-[1px] top-[106px] flex h-11 w-11 items-center justify-center rounded-full bg-[#FFE2C7] text-gray-900 shadow-[0_0_0_3px_#F6F5F7,0_0_0_5px_#D81B72]">
              <Coffee className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="absolute left-[-117px] top-[-186px] flex h-11 w-11 items-center justify-center rounded-full bg-[#D5EBDD] text-gray-900 shadow-[0_0_0_3px_#F6F5F7]">
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="absolute left-[73px] top-[-186px] h-9 w-9 rounded-full bg-[#D9E6FB] shadow-[0_0_0_3px_#F6F5F7]" />
            <span className="absolute left-[-201px] top-[-87px] h-9 w-9 rounded-full bg-pink-100 shadow-[0_0_0_3px_#F6F5F7]" />
            <span className="absolute left-[145px] top-[80px] flex h-11 w-11 items-center justify-center rounded-[14px] bg-purple-600 text-white shadow-[0_0_0_3px_#F6F5F7]">
              <CalendarDays className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-md flex-col gap-6 pb-2.5">
          <div className="flex flex-col gap-3">
            <h1 className="text-balance font-display text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-900">
              {t("welcomeHeadline")}
            </h1>
            <p className="text-pretty text-base leading-normal text-gray-700">{t("welcomeIntro")}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <Button size="lg" className="w-full" onClick={() => setLocation("/register")} data-testid="button-welcome-register">
              {t("welcomeCreateProfile")}
            </Button>
            <button
              type="button"
              className="glass-btn flex h-14 w-full items-center justify-center rounded-[18px] font-display text-base font-semibold text-gray-900"
              onClick={() => setView("form")}
              data-testid="button-welcome-login"
            >
              {t("welcomeHaveAccount")}
            </button>
          </div>
          {termsNotice}
        </div>
      </div>
    );
  }

  // ---------- Login form ----------
  return (
    <div className="safe-page min-h-screen bg-gray-50 px-5" data-testid="view-login">
      <div className="mx-auto flex w-full max-w-md flex-col gap-7">
        <button type="button" className="icon-btn" aria-label={t("back")} onClick={() => setView("welcome")} data-testid="button-back-to-welcome">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex flex-col gap-2.5">
          <img src={heyMamaSymbol} alt="HeyMama" className="mb-2 h-14 w-14 object-contain" />
          <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-gray-900">{t("loginTitle")}</h1>
          <p className="text-pretty text-base leading-normal text-gray-600">{t("loginSubtitle")}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder={t("enterYourEmail")}
                      data-testid="input-email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("password")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder={t("enterYourPassword")}
                        className="pr-12"
                        data-testid="input-password"
                        {...field}
                      />
                      <button
                        type="button"
                        className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-600"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                        aria-pressed={showPassword}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? t("signingIn") : t("signIn")}
              </Button>
            </div>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-pink-700"
                data-testid="link-forgot-password"
              >
                {t("forgotPassword")}
              </Link>
            </div>
          </form>
        </Form>

        <p className="text-center text-sm text-gray-600">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-semibold text-pink-700" data-testid="link-register">
            {t("signUpHere")}
          </Link>
        </p>

        {termsNotice}
      </div>
    </div>
  );
}
