import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Eye, Instagram, MapPin, Pencil, ShoppingBag, SlidersHorizontal, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Link, useLocation } from "wouter";
import type { Profile } from "@shared/schema";
import { instagramHandle } from "@shared/instagram";
import { useLanguage } from "@/contexts/LanguageContext";
import { fill } from "@/lib/format";
import PageSkeleton from "@/components/page-skeleton";
import AppHeader from "@/components/app-header";
import PhotoCarousel from "@/components/photo-carousel";
import InstagramLink from "@/components/instagram-link";

const CURRENT_USER_ID = "current-user";

const PILL = "inline-flex h-8 items-center rounded-full px-3 text-[13px]";
const KID_PILL = `${PILL} bg-purple-50 font-semibold text-purple-700`;
const INTEREST_PILL = `${PILL} bg-gray-50 font-medium text-gray-900`;
// Inside the white sheet the neutral pill needs one step more contrast
const SHEET_INTEREST_PILL = `${PILL} bg-gray-100 font-medium text-gray-900`;

export default function Profile() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  // Old profiles can point at storage that no longer exists (pre-migration
  // photos): fall back to the initial instead of a broken image.
  const [photoError, setPhotoError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["/api/profiles", CURRENT_USER_ID],
  });

  const settingsPill = (
    <Link
      href="/settings"
      className="glass-btn inline-flex h-12 items-center gap-2 rounded-full pl-3 pr-4 text-sm font-semibold text-gray-900"
      data-testid="button-settings"
    >
      <SlidersHorizontal className="h-5 w-5" strokeWidth={1.9} />
      {t("settings")}
    </Link>
  );

  if (isLoading) {
    return (
      <PageSkeleton variant="profile" />
    );
  }

  if (!profile) {
    // Legacy accounts may exist without a profile row: offer to create it
    // instead of dead-ending (saving from the edit page creates the profile).
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <AppHeader title={t("profile")} left="none" right={settingsPill} />
        <main className="flex flex-col items-center gap-4 px-8 pt-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 text-pink-500" aria-hidden="true">
            <UserRound className="h-7 w-7" />
          </span>
          <h2 className="font-display text-xl font-semibold text-gray-900">{t("profileMissingTitle")}</h2>
          <p className="text-gray-600">{t("profileMissingHint")}</p>
          <Button onClick={() => setLocation("/profile/edit")} data-testid="button-complete-profile">
            {t("completeYourProfile")}
          </Button>
          <Button variant="ghost" onClick={() => setLocation("/")} data-testid="button-go-home">
            {t("backToHome")}
          </Button>
        </main>
      </div>
    );
  }

  const isProfessional = profile.accountType === "professional";
  const photos = (profile.photoUrls || []).filter(Boolean);
  const kidsAges = profile.kidsAges || [];
  const hobbies = profile.hobbies || [];
  const personName = `${profile.firstName} ${profile.lastName}`.trim();
  const displayName = isProfessional
    ? profile.businessName || personName
    : `${profile.firstName}${profile.age != null ? `, ${profile.age}` : ""}`;
  const initial = (isProfessional ? profile.businessName || profile.firstName : profile.firstName).trim().charAt(0).toUpperCase();
  const momOf =
    !isProfessional && profile.kidsNumber > 0
      ? profile.kidsNumber === 1
        ? t("momOfOne")
        : fill(t("momOfMany"), { count: profile.kidsNumber })
      : "";
  const subtitle = [profile.location, momOf].filter(Boolean).join(" · ");

  // "2 anni", "1 anno", "Meno di 1 anno"; values that are not numbers are shown as stored
  const kidAge = (age: string) => {
    const n = parseFloat(String(age).replace(",", "."));
    if (Number.isNaN(n)) return age;
    if (n < 1) return t("momKidBaby");
    return Math.round(n) === 1 ? t("kidAgeOne") : fill(t("momKidAge"), { age: Math.round(n) });
  };
  // Own profile: the kid's gender is shown too ("Bimba · 2 anni")
  const kidLabel = (age: string, index: number) => {
    const gender = profile.kidsGenders?.[index];
    const who = gender === "male" ? t("kidBoy") : gender === "female" ? t("kidGirl") : "";
    return who ? `${who} · ${kidAge(age)}` : kidAge(age);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <AppHeader title={t("profile")} left="none" right={settingsPill} />

      <main className="space-y-3.5 px-5">
        <section className="hero-card flex flex-col gap-4" aria-label={t("profileHeroLabel")}>
          <svg aria-hidden="true" width="220" height="220" viewBox="0 0 220 220" className="pointer-events-none absolute -right-20 -top-20">
            <circle cx="110" cy="110" r="50" fill="none" stroke="var(--magenta)" strokeOpacity="0.3" strokeWidth="1.5" />
            <circle cx="110" cy="110" r="80" fill="none" stroke="var(--magenta)" strokeOpacity="0.22" strokeWidth="1.5" />
            <circle cx="110" cy="110" r="108" fill="none" stroke="var(--magenta)" strokeOpacity="0.14" strokeWidth="1.5" />
          </svg>
          <div className="relative flex items-center gap-4">
            {photos.length > 0 && !photoError ? (
              <img
                src={photos[0]}
                alt={t("yourProfilePhoto")}
                className="h-[72px] w-[72px] shrink-0 rounded-full bg-white object-cover"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <span
                className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white font-display text-[26px] font-semibold text-pink-700"
                aria-hidden="true"
              >
                {initial}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="truncate font-display text-2xl font-semibold leading-[1.1] tracking-[-0.02em]" data-testid="text-profile-name">
                {displayName}
              </h2>
              {subtitle && <p className="text-sm font-semibold leading-tight">{subtitle}</p>}
            </div>
          </div>
          <div className={`relative grid gap-2.5 ${isProfessional ? "grid-cols-1" : "grid-cols-2"}`}>
            <Button className="h-12 px-1" onClick={() => setLocation("/profile/edit")} data-testid="button-edit-profile-main">
              <Pencil />
              {t("edit")}
            </Button>
            {/* Professionals never appear in discovery, so there is no "as others see me" */}
            {!isProfessional && (
              <Button
                className="h-12 gap-1.5 bg-white px-1 text-gray-900 hover:bg-white"
                onClick={() => setPreviewOpen(true)}
                data-testid="button-preview-profile"
              >
                <Eye />
                {t("profileHowOthersSee")}
              </Button>
            )}
          </div>
        </section>

        {isProfessional && (
          <section className="card-float flex flex-col gap-3 p-4" aria-labelledby="profile-business">
            <h2 id="profile-business" className="section-label font-sans tracking-normal">{t("professionalAccount")}</h2>
            {profile.professionalCategory && (
              <div className="flex flex-wrap gap-2">
                <span className={KID_PILL}>{profile.professionalCategory}</span>
              </div>
            )}
            <p className="text-[15px] leading-normal text-gray-800">
              <span className="text-gray-600">{t("referentName")}: </span>
              <span className="font-semibold">{personName}</span>
            </p>
          </section>
        )}

        {!isProfessional && (kidsAges.length > 0 || hobbies.length > 0) && (
          <section className="card-float flex flex-col gap-3 p-4" aria-labelledby="profile-kids-interests">
            <h2 id="profile-kids-interests" className="section-label font-sans tracking-normal">{t("profileKidsAndInterests")}</h2>
            <div className="flex flex-wrap gap-2">
              {kidsAges.map((age, index) => (
                <span key={`kid-${index}`} className={KID_PILL}>{kidLabel(age, index)}</span>
              ))}
              {hobbies.map((hobby, index) => (
                <span key={`hobby-${index}`} className={INTEREST_PILL}>{hobby}</span>
              ))}
            </div>
          </section>
        )}

        {profile.bio && (
          <section className="card-float flex flex-col gap-2.5 p-4" aria-labelledby="profile-about">
            <h2 id="profile-about" className="section-label font-sans tracking-normal">{t("profileAboutMe")}</h2>
            <p className="whitespace-pre-line text-pretty text-[15px] leading-normal text-gray-800">{profile.bio}</p>
          </section>
        )}

        {profile.vintedUrl && (
          <button
            type="button"
            onClick={() => window.open(profile.vintedUrl || "", "_blank")}
            className="card-float flex h-[60px] w-full items-center gap-3 px-4 text-left"
            data-testid="button-vinted-profile"
          >
            <ShoppingBag className="h-5 w-5 shrink-0 text-gray-900" strokeWidth={1.9} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-tight text-gray-900">{t("vintedAccount")}</span>
            </span>
            <span className="text-sm font-medium text-gray-600">{t("viewVintedProfile")}</span>
            <ExternalLink className="h-[18px] w-[18px] shrink-0 text-gray-500" />
          </button>
        )}

        {profile.instagramUrl && (
          <a
            href={profile.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="card-float flex h-[60px] w-full items-center gap-3 px-4 text-left"
            data-testid="link-instagram-profile"
          >
            <Instagram className="h-5 w-5 shrink-0 text-gray-900" strokeWidth={1.9} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-tight text-gray-900">{instagramHandle(profile.instagramUrl)}</span>
            </span>
            <span className="text-sm font-medium text-gray-600">{t("instagramOpen")}</span>
            <ExternalLink className="h-[18px] w-[18px] shrink-0 text-gray-500" />
          </a>
        )}
      </main>

      {/* The profile as other moms see it on the map */}
      {!isProfessional && (
        <Drawer open={previewOpen} onOpenChange={setPreviewOpen} shouldScaleBackground={false}>
          <DrawerContent className="h-[92dvh]" data-testid="profile-preview">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] pt-3">
              <div className="relative">
                {photos.length > 0 ? (
                  <PhotoCarousel photos={photos} alt={profile.firstName} className="h-[300px]" rounded="rounded-[28px]" />
                ) : (
                  <div className="flex h-[300px] w-full items-center justify-center rounded-[28px] bg-pink-100 font-display text-6xl font-semibold text-pink-700" aria-hidden="true">
                    {initial}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label={t("close")}
                  className="glass absolute right-3 top-7 flex h-11 w-11 items-center justify-center rounded-full text-gray-900"
                  data-testid="button-close-profile-preview"
                >
                  <X className="h-5 w-5" />
                </button>
                <span className="glass absolute bottom-3 left-3 inline-flex h-[30px] items-center rounded-full px-3 text-xs font-semibold text-gray-900">
                  {t("profilePreviewBadge")}
                </span>
              </div>

              <div className="mt-5 px-1">
                <DrawerTitle className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">{displayName}</DrawerTitle>
                <DrawerDescription className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-600">
                  <MapPin className="h-[15px] w-[15px] shrink-0" />
                  <span className="truncate">{subtitle}</span>
                </DrawerDescription>
              </div>

              {(kidsAges.length > 0 || hobbies.length > 0) && (
                <section className="mt-4 px-1">
                  <h3 className="section-label font-sans tracking-normal">{t("momKidsAndInterests")}</h3>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {kidsAges.map((age, index) => (
                      <span key={`kid-${index}`} className={KID_PILL}>{kidAge(age)}</span>
                    ))}
                    {hobbies.map((hobby, index) => (
                      <span key={`hobby-${index}`} className={SHEET_INTEREST_PILL}>{hobby}</span>
                    ))}
                  </div>
                </section>
              )}

              {profile.bio && <p className="mt-4 whitespace-pre-line px-1 text-[15px] leading-relaxed text-gray-800">{profile.bio}</p>}
              {profile.instagramUrl && <InstagramLink url={profile.instagramUrl} className="mt-4" />}

              <p className="mt-6 px-1 text-center text-[13px] leading-snug text-gray-600">{t("profilePreviewHint")}</p>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
