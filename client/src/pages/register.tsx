import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { registrationSchema, type Registration } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { fill } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ObjectUploader } from "@/components/ObjectUploader";
import CityPicker from "@/components/city-picker";
import {
  Eye, EyeOff, Plus, X, Upload, Heart, Briefcase, ArrowLeft, ArrowRight,
  Check, Users, Sparkles, Minus,
} from "lucide-react";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/translations";

const PROFESSIONAL_CATEGORIES = [
  "Babysitter / Tata",
  "Asilo nido",
  "Pediatra",
  "Psicologia / Supporto genitoriale",
  "Ostetrica",
  "Consulente allattamento",
  "Nutrizionista",
  "Fisioterapista",
  "Logopedista",
  "Corsi e laboratori",
  "Animazione feste",
  "Fotografia",
  "Negozio per bambini",
  "Altro",
];

// Suggested interests: tapping a chip adds the translated label as a hobby
// (hobbies are free text in the profile), custom ones can still be typed.
const INTEREST_KEYS: TranslationKey[] = [
  "interestParks", "interestCoffee", "interestWalks", "interestNature", "interestSports",
  "interestYoga", "interestSwimming", "interestReading", "interestCooking", "interestCrafts",
  "interestMusic", "interestMuseums", "interestLanguages", "interestWorkingMom", "interestNewMom",
];

type StepKey = "type" | "account" | "about" | "where" | "kids" | "interests" | "photos" | "review";

const STEP_TITLES: Record<StepKey, TranslationKey> = {
  type: "stepWhoAreYou",
  account: "stepAccount",
  about: "stepAboutYou",
  where: "stepWhere",
  kids: "stepKids",
  interests: "stepInterests",
  photos: "stepPhotos",
  review: "stepReview",
};

interface CommunityStats {
  totalMoms: number;
  activeMoms14d: number;
}

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [hobbiesInput, setHobbiesInput] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const { t } = useLanguage();

  const form = useForm<Registration & { confirmPassword: string }>({
    resolver: zodResolver(registrationSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      accountType: "mom",
      businessName: "",
      professionalCategory: "",
      firstName: "",
      lastName: "",
      age: undefined,
      sex: undefined,
      bio: "",
      location: "",
      photoUrls: [],
      kidsNumber: 1,
      kidsAges: [],
      kidsGenders: [],
      hobbies: [],
    },
  });

  const accountType = form.watch("accountType");
  const isProfessional = accountType === "professional";
  const province = form.watch("location");
  const kidsNumber = form.watch("kidsNumber") || 0;
  const hobbies = form.watch("hobbies") || [];

  // Professionals skip the kids and interests steps
  const steps: StepKey[] = useMemo(
    () =>
      isProfessional
        ? ["type", "account", "about", "where", "photos", "review"]
        : ["type", "account", "about", "where", "kids", "interests", "photos", "review"],
    [isProfessional],
  );
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const goTo = (key: StepKey) => setStepIndex(Math.max(0, steps.indexOf(key)));

  // Honest density preview for the chosen province (public, aggregated)
  const { data: community } = useQuery<CommunityStats>({
    queryKey: [`/api/community/stats?province=${encodeURIComponent(province || "")}`],
    enabled: !!province && !isProfessional,
    staleTime: 5 * 60 * 1000,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: Registration) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.requiresVerification === false) {
        // Account created directly (email service unavailable)
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        toast({ title: t("welcomeToHeyMama"), description: t("accountCreatedSuccess") });
        setTimeout(() => setLocation("/"), 100);
      } else {
        setUserEmail(form.getValues("email"));
        setShowVerification(true);
        toast({ title: t("verificationEmailSent"), description: t("checkEmailMessage") });
      }
    },
    onError: (error: any) => {
      const duplicate = String(error?.message || "").startsWith("409:");
      toast({
        title: t("registrationFailed"),
        description: duplicate ? t("emailAlreadyExists") : t("somethingWentWrong"),
        variant: "destructive",
      });
      if (duplicate) goTo("account");
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/auth/verify-email", { verificationCode: code });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: t("welcomeToHeyMama"), description: t("accountCreatedSuccess") });
      setTimeout(() => setLocation("/"), 100);
    },
    onError: (error: any) => {
      toast({
        title: t("verificationFailed"),
        description: error.message || t("invalidVerificationCode"),
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload/public");
    const data = await response.json();
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const handleUploadComplete = async (result: any) => {
    const uploadedFiles = result.successful;
    if (uploadedFiles.length > 0) {
      const newPhotoUrls = uploadedFiles.map((file: any) => file.uploadURL);
      setUploadedPhotos((prev) => {
        const updatedPhotos = [...prev, ...newPhotoUrls];
        form.setValue("photoUrls", updatedPhotos);
        return updatedPhotos;
      });
      toast({ title: t("photosUploaded"), description: `${uploadedFiles.length} ${t("photosUploadedSuccess")}` });
    }
  };

  const removePhoto = (indexToRemove: number) => {
    const newPhotos = uploadedPhotos.filter((_, index) => index !== indexToRemove);
    setUploadedPhotos(newPhotos);
    form.setValue("photoUrls", newPhotos);
  };

  const toggleHobby = (hobby: string) => {
    const current = form.getValues("hobbies") || [];
    const exists = current.some((h) => h.toLowerCase() === hobby.toLowerCase());
    form.setValue("hobbies", exists ? current.filter((h) => h.toLowerCase() !== hobby.toLowerCase()) : [...current, hobby]);
  };

  const addHobby = () => {
    const hobby = hobbiesInput.trim();
    if (hobby && !(form.getValues("hobbies") || []).some((h) => h.toLowerCase() === hobby.toLowerCase())) {
      form.setValue("hobbies", [...(form.getValues("hobbies") || []), hobby]);
    }
    setHobbiesInput("");
  };

  const setKidsNumber = (n: number) => {
    const next = Math.max(1, Math.min(6, n));
    form.setValue("kidsNumber", next);
    form.setValue("kidsAges", (form.getValues("kidsAges") || []).slice(0, next));
    form.setValue("kidsGenders", (form.getValues("kidsGenders") || []).slice(0, next));
  };

  // Validates only the fields of the current step, so each screen gives
  // immediate, local feedback instead of one big error list at the end.
  const validateStep = async (): Promise<boolean> => {
    switch (step) {
      case "type":
        return true;
      case "account":
        return form.trigger(["email", "password", "confirmPassword"]);
      case "about": {
        const fields: any[] = ["firstName", "lastName", "age"];
        if (isProfessional) fields.push("businessName", "professionalCategory");
        return form.trigger(fields);
      }
      case "where":
        return form.trigger(["location"]);
      case "kids": {
        const ages = form.getValues("kidsAges") || [];
        const complete = Array.from({ length: kidsNumber }, (_, i) => ages[i]).every((a) => a !== undefined && String(a).trim() !== "");
        if (!complete) {
          toast({ title: t("kidsAgesRequired"), variant: "destructive" });
          return false;
        }
        return true;
      }
      case "interests":
        if ((form.getValues("hobbies") || []).length === 0) {
          toast({ title: t("interestRequired"), variant: "destructive" });
          return false;
        }
        return true;
      case "photos": {
        if (uploadedPhotos.length === 0) {
          toast({ title: t("photoRequired"), variant: "destructive" });
          return false;
        }
        return form.trigger(["bio"]);
      }
      default:
        return true;
    }
  };

  const next = async () => {
    if (await validateStep()) setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  const onInvalid = (errors: Record<string, any>) => {
    const firstError = Object.values(errors).find(
      (e: any) => typeof e?.message === "string" && e.message,
    ) as { message?: string } | undefined;
    toast({ title: t("registrationFailed"), description: firstError?.message, variant: "destructive" });
  };

  const onSubmit = (data: Registration) => {
    if (!acceptedTerms) {
      toast({ title: t("registrationFailed"), description: t("mustAcceptTerms"), variant: "destructive" });
      return;
    }
    registerMutation.mutate({
      ...data,
      photoUrls: uploadedPhotos,
      // Professionals have no kids/hobbies sections
      ...(data.accountType === "professional"
        ? { kidsNumber: 0, kidsAges: [], kidsGenders: [], hobbies: [] }
        : {}),
    });
  };

  const progress = ((stepIndex + 1) / steps.length) * 100;
  const gradientButton = "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white";

  // ---------- Email verification screen ----------
  if (showVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-8 px-4">
        <div className="max-w-md mx-auto">
          <Card className="rounded-3xl">
            <CardContent className="pt-8 space-y-6">
              <div className="flex justify-center">
                <img src={heyMamaLogo} alt="HeyMama" className="h-14 w-auto object-contain" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">{t("checkYourEmail")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("verificationSentMessage")} <strong>{userEmail}</strong>
                </p>
              </div>
              <div>
                <label htmlFor="verification-code" className="block text-sm font-medium mb-2">
                  {t("verificationCode")}
                </label>
                <Input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t("enterVerificationCode")}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
                  className="text-center text-xl tracking-widest"
                  data-testid="input-verification-code"
                />
              </div>
              <Button
                onClick={() => verifyEmailMutation.mutate(verificationCode)}
                className={`w-full ${gradientButton}`}
                disabled={verificationCode.length !== 6 || verifyEmailMutation.isPending}
                data-testid="button-verify-email"
              >
                {verifyEmailMutation.isPending ? t("verifying") : t("verifyEmail")}
              </Button>
              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => setShowVerification(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="button-back-to-form"
                >
                  {t("backToRegistration")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- Wizard ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-6 px-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          {stepIndex > 0 ? (
            <Button variant="ghost" size="icon" className="rounded-full" onClick={back} aria-label={t("back")} data-testid="button-wizard-back">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Button>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("back")} data-testid="button-wizard-login">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Button>
            </Link>
          )}
          <img src={heyMamaLogo} alt="HeyMama" className="h-10 w-auto object-contain" />
          <span className="w-10 text-right text-xs font-medium text-gray-500">{stepIndex + 1}/{steps.length}</span>
        </div>

        {/* Progress */}
        <div className="h-1.5 w-full rounded-full bg-white/70 overflow-hidden mb-5">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
          />
        </div>

        <Card className="rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-pink-500 mb-1">
              {fill(t("stepOf"), { current: stepIndex + 1, total: steps.length })}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mb-5">{t(STEP_TITLES[step])}</h1>

            <Form {...form}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (step === "review") form.handleSubmit(onSubmit, onInvalid)(e);
                  else next();
                }}
                className="space-y-5"
              >
                {/* STEP: account type */}
                {step === "type" && (
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => { form.setValue("accountType", "mom"); setStepIndex(1); }}
                      className={`rounded-2xl border-2 p-4 text-left transition-all ${
                        !isProfessional ? "border-pink-400 bg-pink-50/60 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                      data-testid="button-account-mom"
                    >
                      <Heart className={`h-6 w-6 mb-2 ${!isProfessional ? "text-pink-500" : "text-gray-400"}`} />
                      <p className="font-semibold text-gray-900">{t("iAmMom")}</p>
                      <p className="text-sm text-gray-500 mt-1">{t("iAmMomDesc")}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => { form.setValue("accountType", "professional"); setStepIndex(1); }}
                      className={`rounded-2xl border-2 p-4 text-left transition-all ${
                        isProfessional ? "border-pink-400 bg-pink-50/60 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                      data-testid="button-account-professional"
                    >
                      <Briefcase className={`h-6 w-6 mb-2 ${isProfessional ? "text-pink-500" : "text-gray-400"}`} />
                      <p className="font-semibold text-gray-900">{t("iAmProfessional")}</p>
                      <p className="text-sm text-gray-500 mt-1">{t("iAmProfessionalDesc")}</p>
                    </button>
                  </div>
                )}

                {/* STEP: account */}
                {step === "account" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t("accountHint")}</p>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("email")}</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="email" inputMode="email" placeholder={t("enterYourEmail")} data-testid="input-email" {...field} />
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
                                autoComplete="new-password"
                                placeholder={t("createStrongPassword")}
                                data-testid="input-password"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                                onClick={() => setShowPassword(!showPassword)}
                                data-testid="button-toggle-password"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("confirmPassword")}</FormLabel>
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder={t("confirmYourPassword")}
                              data-testid="input-confirmPassword"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* STEP: about you (+ business for professionals) */}
                {step === "about" && (
                  <div className="space-y-4">
                    {isProfessional && (
                      <>
                        <FormField
                          control={form.control}
                          name="businessName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("businessNameLabel")}</FormLabel>
                              <FormControl>
                                <Input placeholder={t("businessNamePlaceholder")} data-testid="input-businessName" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="professionalCategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("professionalCategoryLabel")}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-professionalCategory">
                                    <SelectValue placeholder={t("selectProfessionalCategory")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {PROFESSIONAL_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <p className="text-sm font-medium text-gray-700 pt-2">{t("referentName")}</p>
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("firstName")}</FormLabel>
                            <FormControl>
                              <Input autoComplete="given-name" placeholder={t("yourFirstName")} data-testid="input-firstName" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("lastName")}</FormLabel>
                            <FormControl>
                              <Input autoComplete="family-name" placeholder={t("yourLastName")} data-testid="input-lastName" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("age")} <span className="text-muted-foreground font-normal">({t("optional")})</span></FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min="18"
                                max="65"
                                data-testid="input-age"
                                name={field.name}
                                ref={field.ref}
                                onBlur={field.onBlur}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sex"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("gender")} <span className="text-muted-foreground font-normal">({t("optional")})</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""} data-testid="select-sex">
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("selectGender")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="female">{t("female")}</SelectItem>
                                <SelectItem value="male">{t("male")}</SelectItem>
                                <SelectItem value="other">{t("other")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* STEP: where */}
                {step === "where" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t("whereHint")}</p>
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("province")}</FormLabel>
                          <FormControl>
                            <CityPicker value={field.value} onChange={field.onChange} testId="select-province" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {!isProfessional && province && community && (
                      <div className="rounded-2xl bg-pink-50 border border-pink-100 p-4 flex items-start gap-3" data-testid="province-density">
                        <Users className="h-5 w-5 text-pink-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700">
                          {community.totalMoms > 0
                            ? fill(t("momsAlreadyHere"), { count: community.totalMoms, province })
                            : fill(t("firstMomsHere"), { province })}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP: kids */}
                {step === "kids" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t("kidsHint")}</p>
                    <div className="flex items-center justify-between rounded-2xl border p-3">
                      <span className="font-medium text-gray-800">{t("numberOfKids")}</span>
                      <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => setKidsNumber(kidsNumber - 1)} disabled={kidsNumber <= 1} data-testid="button-kids-minus">
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center text-lg font-semibold" data-testid="text-kids-number">{kidsNumber}</span>
                        <Button type="button" variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => setKidsNumber(kidsNumber + 1)} disabled={kidsNumber >= 6} data-testid="button-kids-plus">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {Array.from({ length: kidsNumber }, (_, index) => (
                        <div key={index} className="rounded-2xl bg-gray-50 p-3">
                          <p className="text-sm font-medium text-gray-800 mb-2">{t("kid")} {index + 1}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <FormLabel className="text-xs">{t("age")}</FormLabel>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max="18"
                                placeholder={t("age")}
                                data-testid={`input-kid-age-${index}`}
                                value={form.watch("kidsAges")?.[index] ?? ""}
                                onChange={(e) => {
                                  const newAges = [...(form.getValues("kidsAges") || [])];
                                  newAges[index] = e.target.value;
                                  form.setValue("kidsAges", newAges);
                                }}
                              />
                            </div>
                            <div>
                              <FormLabel className="text-xs">{t("gender")}</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  const newGenders = [...(form.getValues("kidsGenders") || [])];
                                  newGenders[index] = value;
                                  form.setValue("kidsGenders", newGenders);
                                }}
                                value={form.watch("kidsGenders")?.[index] || ""}
                              >
                                <SelectTrigger data-testid={`select-kid-gender-${index}`}>
                                  <SelectValue placeholder={t("select")} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="male">{t("boy")}</SelectItem>
                                  <SelectItem value="female">{t("girl")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP: interests */}
                {step === "interests" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t("suggestedInterests")}</p>
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_KEYS.map((key) => {
                        const label = t(key);
                        const active = hobbies.some((h) => h.toLowerCase() === label.toLowerCase());
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleHobby(label)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              active ? "border-pink-400 bg-pink-50 text-pink-700 font-medium" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                            }`}
                            aria-pressed={active}
                            data-testid={`chip-${key}`}
                          >
                            {active && <Check className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("hobbyExamples")}
                        value={hobbiesInput}
                        onChange={(e) => setHobbiesInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addHobby();
                          }
                        }}
                        data-testid="input-hobby"
                      />
                      <Button type="button" variant="outline" onClick={addHobby} data-testid="button-add-hobby">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {hobbies.filter((h) => !INTEREST_KEYS.some((k) => t(k).toLowerCase() === h.toLowerCase())).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {hobbies
                          .filter((h) => !INTEREST_KEYS.some((k) => t(k).toLowerCase() === h.toLowerCase()))
                          .map((hobby, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                              {hobby}
                              <button type="button" onClick={() => toggleHobby(hobby)} className="ml-1" aria-label={t("delete")} data-testid={`button-remove-hobby-${index}`}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP: photos + bio */}
                {step === "photos" && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">{t("photosHint")}</p>
                      {uploadedPhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                          {uploadedPhotos.map((photoUrl, index) => (
                            <div key={index} className="relative aspect-square">
                              <img src={photoUrl} alt={`${t("profilePhoto")} ${index + 1}`} className="w-full h-full object-cover rounded-xl" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 shadow flex items-center justify-center"
                                onClick={() => removePhoto(index)}
                                aria-label={t("delete")}
                                data-testid={`button-remove-photo-${index}`}
                              >
                                <X className="h-3.5 w-3.5 text-gray-700" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {uploadedPhotos.length < 5 && (
                        <ObjectUploader
                          maxNumberOfFiles={5 - uploadedPhotos.length}
                          maxFileSize={5 * 1024 * 1024}
                          onGetUploadParameters={handleGetUploadParameters}
                          onComplete={handleUploadComplete}
                          buttonClassName="w-full"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {t("uploadPhotos")} ({uploadedPhotos.length}/5)
                        </ObjectUploader>
                      )}
                    </div>
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("aboutYou")}</FormLabel>
                          <p className="text-xs text-muted-foreground">{t("bioHint")}</p>
                          <FormControl>
                            <Textarea
                              placeholder={isProfessional ? t("professionalBioPlaceholder") : t("aboutYouPlaceholder")}
                              className="min-h-[100px]"
                              data-testid="textarea-bio"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* STEP: review + terms */}
                {step === "review" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t("reviewYourProfile")}</p>
                    <div className="rounded-2xl border divide-y">
                      <ReviewRow label={t("email")} value={form.getValues("email")} onEdit={() => goTo("account")} editLabel={t("edit")} />
                      <ReviewRow
                        label={isProfessional ? t("businessNameLabel") : t("basicInformation")}
                        value={isProfessional
                          ? `${form.getValues("businessName")} · ${form.getValues("professionalCategory")} · ${form.getValues("firstName")} ${form.getValues("lastName")}`
                          : `${form.getValues("firstName")} ${form.getValues("lastName")}${form.getValues("age") ? `, ${form.getValues("age")}` : ""}`}
                        onEdit={() => goTo("about")}
                        editLabel={t("edit")}
                      />
                      <ReviewRow label={t("province")} value={province} onEdit={() => goTo("where")} editLabel={t("edit")} />
                      {!isProfessional && (
                        <>
                          <ReviewRow
                            label={t("kids")}
                            value={(form.getValues("kidsAges") || []).slice(0, kidsNumber).map((a) => `${a} ${t("yearsOld")}`).join(", ")}
                            onEdit={() => goTo("kids")}
                            editLabel={t("edit")}
                          />
                          <ReviewRow label={t("interests")} value={hobbies.join(", ")} onEdit={() => goTo("interests")} editLabel={t("edit")} />
                        </>
                      )}
                      <div className="p-3 flex items-center justify-between gap-3">
                        <div className="flex -space-x-2">
                          {uploadedPhotos.slice(0, 5).map((url, i) => (
                            <img key={i} src={url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white" />
                          ))}
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="text-pink-600" onClick={() => goTo("photos")} data-testid="button-edit-photos">
                          {t("edit")}
                        </Button>
                      </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={acceptedTerms}
                        onCheckedChange={(v) => setAcceptedTerms(v === true)}
                        className="mt-0.5"
                        data-testid="checkbox-register-terms"
                      />
                      <span className="text-sm text-muted-foreground">
                        {t("registerAcceptTerms")}{" "}
                        (
                        <Link href="/terms" className="text-pink-600 hover:text-pink-700 underline" data-testid="link-register-terms">
                          {t("termsOfUse")}
                        </Link>
                        {" · "}
                        <Link href="/privacy" className="text-pink-600 hover:text-pink-700 underline" data-testid="link-register-privacy">
                          {t("privacyPolicy")}
                        </Link>
                        )
                      </span>
                    </label>
                  </div>
                )}

                {/* Footer action */}
                {step !== "type" && (
                  <Button
                    type="submit"
                    className={`w-full h-12 rounded-full ${gradientButton}`}
                    disabled={step === "review" ? registerMutation.isPending || !acceptedTerms : false}
                    data-testid={step === "review" ? "button-register" : "button-wizard-next"}
                  >
                    {step === "review" ? (
                      registerMutation.isPending ? t("sendingVerification") : (<><Sparkles className="h-4 w-4 mr-2" />{t("createAccount")}</>)
                    ) : (
                      <>{t("next")}<ArrowRight className="h-4 w-4 ml-2" /></>
                    )}
                  </Button>
                )}
              </form>
            </Form>

            {stepIndex === 0 && (
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">{t("alreadyHaveAccount")} </span>
                <Link href="/login">
                  <Button variant="link" className="p-0 h-auto text-sm font-medium text-pink-600 hover:text-pink-700" data-testid="link-login">
                    {t("signInHere")}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, onEdit, editLabel }: { label: string; value: string; onEdit: () => void; editLabel: string }) {
  return (
    <div className="p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value || "—"}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" className="text-pink-600 shrink-0" onClick={onEdit}>
        {editLabel}
      </Button>
    </div>
  );
}
