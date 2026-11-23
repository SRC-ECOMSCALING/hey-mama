import { useMemo, useState, type ReactNode } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ObjectUploader } from "@/components/ObjectUploader";
import CityPicker from "@/components/city-picker";
import {
  Eye, EyeOff, Plus, X, Upload, Heart, Briefcase, ArrowLeft, ArrowRight,
  Check, Users, Minus,
} from "lucide-react";
import heyMamaSymbol from "@assets/heymama-symbol.png";
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

// Each step asks one question (the title) and explains it in one sentence.
const STEP_TITLES: Record<StepKey, TranslationKey> = {
  type: "stepWhoAreYou",
  account: "regAccountTitle",
  about: "regAboutTitle",
  where: "stepWhere",
  kids: "regKidsTitle",
  interests: "regInterestsTitle",
  photos: "regPhotosTitle",
  review: "regReviewTitle",
};

const STEP_HINTS: Record<StepKey, TranslationKey> = {
  type: "regTypeHint",
  account: "accountHint",
  about: "regAboutHint",
  where: "whereHint",
  kids: "kidsHint",
  interests: "suggestedInterests",
  photos: "photosHint",
  review: "regReviewHint",
};

const STEP_TITLE_CLASS = "font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-gray-900";

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

  const customHobbies = hobbies.filter((h) => !INTEREST_KEYS.some((k) => t(k).toLowerCase() === h.toLowerCase()));
  const stepTitle = step === "about" && isProfessional ? t("regAboutProTitle") : t(STEP_TITLES[step]);
  const stepHint = step === "about" && isProfessional ? t("regAboutProHint") : t(STEP_HINTS[step]);

  // ---------- Email verification screen ----------
  if (showVerification) {
    return (
      <div className="safe-page min-h-screen bg-gray-50 px-5">
        <div className="mx-auto flex w-full max-w-md flex-col gap-7">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowVerification(false)}
            aria-label={t("back")}
            data-testid="button-back-to-form"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col gap-2.5">
            <img src={heyMamaSymbol} alt="HeyMama" className="mb-2 h-14 w-14 object-contain" />
            <h1 className={STEP_TITLE_CLASS}>{t("checkYourEmail")}</h1>
            <p className="text-pretty text-base leading-normal text-gray-600">
              {t("verificationSentMessage")} <strong className="break-all font-semibold text-gray-900">{userEmail}</strong>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="verification-code">{t("verificationCode")}</Label>
            <Input
              id="verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={t("enterVerificationCode")}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
              className="h-14 text-center font-display text-xl tracking-widest placeholder:font-sans placeholder:text-base placeholder:tracking-normal"
              data-testid="input-verification-code"
            />
          </div>
          <Button
            size="lg"
            onClick={() => verifyEmailMutation.mutate(verificationCode)}
            className="w-full"
            disabled={verificationCode.length !== 6 || verifyEmailMutation.isPending}
            data-testid="button-verify-email"
          >
            {verifyEmailMutation.isPending ? t("verifying") : t("verifyEmail")}
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Wizard ----------
  return (
    <div className="safe-page flex min-h-screen flex-col bg-gray-50 px-5">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7">
        <div className="flex items-center gap-3.5">
          {stepIndex > 0 ? (
            <button type="button" className="icon-btn" onClick={back} aria-label={t("back")} data-testid="button-wizard-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link href="/login" className="icon-btn" aria-label={t("back")} data-testid="button-wizard-login">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <div
            role="img"
            aria-label={fill(t("stepOf"), { current: stepIndex + 1, total: steps.length })}
            className="flex flex-1 gap-[5px]"
          >
            {steps.map((key, i) => (
              <span key={key} className={`h-[5px] flex-1 rounded-full ${i <= stepIndex ? "bg-pink-500" : "bg-gray-300"}`} />
            ))}
          </div>
          <span className="shrink-0 text-[13px] font-semibold leading-none text-gray-600" aria-hidden="true">
            {fill(t("regStepCount"), { current: stepIndex + 1, total: steps.length })}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <h1 className={STEP_TITLE_CLASS}>{stepTitle}</h1>
          <p className="text-pretty text-base leading-normal text-gray-600">{stepHint}</p>
        </div>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step === "review") form.handleSubmit(onSubmit, onInvalid)(e);
              else next();
            }}
            className="flex flex-1 flex-col gap-7"
          >
            {/* STEP: account type */}
            {step === "type" && (
              <div className="grid grid-cols-1 gap-3">
                <ChoiceCard
                  icon={<Heart className="h-5 w-5" />}
                  title={t("iAmMom")}
                  description={t("iAmMomDesc")}
                  selected={!isProfessional}
                  onClick={() => { form.setValue("accountType", "mom"); setStepIndex(1); }}
                  testId="button-account-mom"
                />
                <ChoiceCard
                  icon={<Briefcase className="h-5 w-5" />}
                  title={t("iAmProfessional")}
                  description={t("iAmProfessionalDesc")}
                  selected={isProfessional}
                  onClick={() => { form.setValue("accountType", "professional"); setStepIndex(1); }}
                  testId="button-account-professional"
                />
              </div>
            )}

            {/* STEP: account */}
            {step === "account" && (
              <div className="space-y-4">
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
                    <h2 className="section-label pt-3 font-sans tracking-normal">{t("referentName")}</h2>
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
                        <FormLabel>{t("age")} <span className="font-normal text-gray-600">({t("optional")})</span></FormLabel>
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
                        <FormLabel>{t("gender")} <span className="font-normal text-gray-600">({t("optional")})</span></FormLabel>
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
                  <div className="hero-card flex items-center gap-3.5" data-testid="province-density">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-pink-700" aria-hidden="true">
                      <Users className="h-5 w-5" />
                    </span>
                    <p className="text-pretty text-[15px] font-semibold leading-snug text-gray-900">
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
              <div className="space-y-3">
                <div className="card-float flex items-center justify-between gap-3 p-4">
                  <span className="text-[15px] font-semibold text-gray-900">{t("numberOfKids")}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-900 disabled:opacity-40"
                      onClick={() => setKidsNumber(kidsNumber - 1)}
                      disabled={kidsNumber <= 1}
                      aria-label={t("regFewerKids")}
                      data-testid="button-kids-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-display text-2xl font-semibold text-gray-900" aria-live="polite" data-testid="text-kids-number">{kidsNumber}</span>
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-900 disabled:opacity-40"
                      onClick={() => setKidsNumber(kidsNumber + 1)}
                      disabled={kidsNumber >= 6}
                      aria-label={t("regMoreKids")}
                      data-testid="button-kids-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {Array.from({ length: kidsNumber }, (_, index) => {
                  const gender = form.watch("kidsGenders")?.[index] || "";
                  return (
                    <div key={index} className="card-float space-y-3 p-4">
                      <h2 className="section-label font-sans tracking-normal">{t("kid")} {index + 1}</h2>
                      <div className="flex items-end gap-3">
                        <div className="w-24 shrink-0 space-y-2">
                          <Label htmlFor={`kid-age-${index}`}>{t("age")}</Label>
                          <Input
                            id={`kid-age-${index}`}
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
                        <div className="flex flex-1 flex-wrap gap-2" role="group" aria-label={t("gender")} data-testid={`select-kid-gender-${index}`}>
                          {([["male", t("kidBoy")], ["female", t("kidGirl")]] as const).map(([value, label]) => {
                            const active = gender === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                className={`chip chip-lg ${active ? "chip-on pl-3" : "bg-gray-50"}`}
                                aria-pressed={active}
                                onClick={() => {
                                  const newGenders = [...(form.getValues("kidsGenders") || [])];
                                  newGenders[index] = value;
                                  form.setValue("kidsGenders", newGenders);
                                }}
                                data-testid={`chip-kid-gender-${index}-${value}`}
                              >
                                {active && <Check className="h-4 w-4 text-pink-500" strokeWidth={2.6} />}
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP: interests */}
            {step === "interests" && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2.5">
                  {INTEREST_KEYS.map((key) => {
                    const label = t(key);
                    const active = hobbies.some((h) => h.toLowerCase() === label.toLowerCase());
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleHobby(label)}
                        className={`chip chip-lg ${active ? "chip-on pl-3" : ""}`}
                        aria-pressed={active}
                        data-testid={`chip-${key}`}
                      >
                        {active && <Check className="h-4 w-4 text-pink-500" strokeWidth={2.6} />}
                        {label}
                      </button>
                    );
                  })}
                  {customHobbies.map((hobby, index) => (
                    <span key={hobby} className="chip chip-lg chip-on pr-1.5">
                      {hobby}
                      <button
                        type="button"
                        onClick={() => toggleHobby(hobby)}
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        aria-label={`${t("delete")} ${hobby}`}
                        data-testid={`button-remove-hobby-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("hobbyExamples")}
                    aria-label={t("addHobby")}
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
                  <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={addHobby} aria-label={t("addHobby")} data-testid="button-add-hobby">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: photos + bio */}
            {step === "photos" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  {uploadedPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {uploadedPhotos.map((photoUrl, index) => (
                        <div key={index} className="relative aspect-square">
                          <img src={photoUrl} alt={`${t("profilePhoto")} ${index + 1}`} className="h-full w-full rounded-[20px] object-cover" />
                          <button
                            type="button"
                            className="glass absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-gray-900"
                            onClick={() => removePhoto(index)}
                            aria-label={t("delete")}
                            data-testid={`button-remove-photo-${index}`}
                          >
                            <X className="h-4 w-4" />
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
                      buttonClassName="h-14 w-full"
                    >
                      <Upload />
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
                      <p className="text-[13px] leading-snug text-gray-600">{t("bioHint")}</p>
                      <FormControl>
                        <Textarea
                          placeholder={isProfessional ? t("professionalBioPlaceholder") : t("aboutYouPlaceholder")}
                          className="min-h-[120px]"
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
              <div className="space-y-3">
                <div className="card-float px-4">
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
                </div>
                {!isProfessional && (
                  <div className="card-float px-4">
                    <ReviewRow
                      label={t("kids")}
                      value={(form.getValues("kidsAges") || []).slice(0, kidsNumber).map((a) => `${a} ${t("yearsOld")}`).join(", ")}
                      onEdit={() => goTo("kids")}
                      editLabel={t("edit")}
                    />
                    <ReviewRow label={t("interests")} value={hobbies.join(", ")} onEdit={() => goTo("interests")} editLabel={t("edit")} />
                  </div>
                )}
                <div className="card-float flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex -space-x-2">
                    {uploadedPhotos.slice(0, 5).map((url, i) => (
                      <img key={i} src={url} alt="" className="h-11 w-11 rounded-full border-2 border-white object-cover" />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="-mr-2 flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold text-pink-700"
                    onClick={() => goTo("photos")}
                    data-testid="button-edit-photos"
                  >
                    {t("edit")}
                  </button>
                </div>

                <label className="card-float flex cursor-pointer items-start gap-3 p-4">
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(v) => setAcceptedTerms(v === true)}
                    className="mt-0.5"
                    data-testid="checkbox-register-terms"
                  />
                  <span className="text-sm leading-relaxed text-gray-700">
                    {t("registerAcceptTerms")}{" "}
                    (
                    <Link href="/terms" className="font-medium text-pink-700 underline" data-testid="link-register-terms">
                      {t("termsOfUse")}
                    </Link>
                    {" · "}
                    <Link href="/privacy" className="font-medium text-pink-700 underline" data-testid="link-register-privacy">
                      {t("privacyPolicy")}
                    </Link>
                    )
                  </span>
                </label>
              </div>
            )}

            {/* Footer action, pushed to the bottom of the screen */}
            <div className="mt-auto flex flex-col gap-3">
              {step === "interests" && (
                <p className="text-center text-[13px] font-medium leading-snug text-gray-600" aria-live="polite">
                  {fill(t("regInterestsCount"), { count: hobbies.length })}
                </p>
              )}
              {step !== "type" && (
                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2.5 [&_svg]:size-[18px]"
                  disabled={step === "review" ? registerMutation.isPending || !acceptedTerms : false}
                  data-testid={step === "review" ? "button-register" : "button-wizard-next"}
                >
                  {step === "review" ? (
                    registerMutation.isPending ? t("sendingVerification") : t("createAccount")
                  ) : (
                    <>{t("regContinue")}<ArrowRight strokeWidth={2.2} /></>
                  )}
                </Button>
              )}
              {stepIndex === 0 && (
                <p className="text-center text-sm text-gray-600">
                  {t("alreadyHaveAccount")}{" "}
                  <Link href="/login" className="font-semibold text-pink-700" data-testid="link-login">
                    {t("signInHere")}
                  </Link>
                </p>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

function ChoiceCard({ icon, title, description, selected, onClick, testId }: {
  icon: ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center gap-3.5 rounded-3xl p-4 text-left transition-colors ${
        selected ? "bg-pink-50 shadow-[inset_0_0_0_2px_var(--magenta)]" : "card-float"
      }`}
      data-testid={testId}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${selected ? "bg-white text-pink-500" : "bg-gray-100 text-gray-700"}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-display text-[17px] font-semibold leading-tight ${selected ? "text-pink-700" : "text-gray-900"}`}>{title}</span>
        <span className="mt-1 block text-sm leading-snug text-gray-600">{description}</span>
      </span>
      {selected && <Check className="h-5 w-5 shrink-0 text-pink-500" strokeWidth={2.6} aria-hidden="true" />}
    </button>
  );
}

function ReviewRow({ label, value, onEdit, editLabel }: { label: string; value: string; onEdit: () => void; editLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 py-3.5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <p className="mt-1 truncate text-[15px] font-semibold text-gray-900">{value || "—"}</p>
      </div>
      <button
        type="button"
        className="-mr-2 flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold text-pink-700"
        onClick={onEdit}
      >
        {editLabel}
      </button>
    </div>
  );
}
