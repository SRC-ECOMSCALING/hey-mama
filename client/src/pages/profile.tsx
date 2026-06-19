import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, LogOut, ShoppingBag, ExternalLink, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import { useLocation } from "wouter";
import type { Profile } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";

const CURRENT_USER_ID = "current-user";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { logout, isLoggingOut } = useAuth();
  const { t } = useLanguage();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["/api/profiles", CURRENT_USER_ID],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-pink"></div>
      </div>
    );
  }

  if (!profile) {
    // Legacy accounts may exist without a profile row: offer to create it
    // instead of dead-ending (saving from the edit page creates the profile).
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
        <p className="text-gray-600">{t("profileNotFound")}</p>
        <Button
          className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
          onClick={() => setLocation("/profile/edit")}
          data-testid="button-complete-profile"
        >
          Completa il tuo profilo
        </Button>
        <Button variant="ghost" onClick={() => setLocation("/")} data-testid="button-go-home">
          Torna alla home
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <div className="text-center flex items-center">
            <img 
              src={heyMamaLogo} 
              alt="HeyMama" 
              className="h-10 w-auto object-contain"
            />
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-edit-profile"
          >
            <Edit className="h-5 w-5 text-gray-600" />
          </Button>
        </div>
      </header>

      {/* Profile Content */}
      <div className="p-6 pb-nav">
        <div className="text-center mb-8">
          {profile.photoUrls && profile.photoUrls.length > 0 ? (
            <img
              src={profile.photoUrls[0]}
              alt={t("yourProfilePhoto")}
              className="w-32 h-32 rounded-full object-cover mx-auto mb-4 shadow-lg"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-200 to-purple-200 mx-auto mb-4 shadow-lg flex items-center justify-center">
              <span className="text-gray-500 text-sm text-center px-2">{t("yourProfilePhoto")}</span>
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{profile.firstName} {profile.lastName}</h2>
          {profile.age != null && <p className="text-gray-600">{profile.age} {t("yearsOld")}</p>}
        </div>

        <div className="space-y-6">
          <div className="p-4 rounded-2xl" style={{ backgroundColor: "var(--warm-gray)" }}>
            <h3 className="font-semibold text-gray-800 mb-3">{t("myKids")}</h3>
            <div className="flex gap-2">
              {profile.kidsAges.map((age, index) => (
                <span
                  key={index}
                  className="px-4 py-2 rounded-full font-medium text-sm"
                  style={{ 
                    backgroundColor: index % 2 === 0 ? "rgba(244, 166, 205, 0.2)" : "rgba(135, 206, 235, 0.2)",
                    color: index % 2 === 0 ? "var(--primary-pink)" : "var(--primary-blue)"
                  }}
                >
                  {t("age")} {age}
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl" style={{ backgroundColor: "var(--warm-gray)" }}>
            <h3 className="font-semibold text-gray-800 mb-3">{t("interests")}</h3>
            <div className="flex flex-wrap gap-2">
              {profile.hobbies.map((hobby, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full text-sm"
                  style={{ 
                    backgroundColor: `rgba(${index % 2 === 0 ? '255, 143, 163' : '152, 216, 232'}, 0.2)`,
                    color: index % 2 === 0 ? "var(--accent-coral)" : "var(--accent-powder)"
                  }}
                >
                  {hobby}
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl" style={{ backgroundColor: "var(--warm-gray)" }}>
            <h3 className="font-semibold text-gray-800 mb-3">{t("aboutMe")}</h3>
            <p className="text-gray-600 leading-relaxed">{profile.bio}</p>
          </div>

          {profile.vintedUrl && (
            <div className="p-4 rounded-2xl" style={{ backgroundColor: "var(--warm-gray)" }}>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                {t("vintedAccount")}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(profile.vintedUrl || '', '_blank')}
                className="w-full justify-between bg-white hover:bg-gray-50"
                data-testid="button-vinted-profile"
              >
                <span>{t("viewVintedProfile")}</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <Button 
              className="w-full py-4 rounded-2xl font-semibold text-white"
              style={{ 
                background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
              }}
              onClick={() => setLocation("/profile/edit")}
              data-testid="button-edit-profile-main"
            >
              {t("editProfile")}
            </Button>
            <Button 
              variant="outline"
              className="w-full py-4 rounded-2xl font-semibold"
              onClick={() => setLocation("/settings")}
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              {t("settings")}
            </Button>
            <Button
              variant="outline"
              className="w-full py-4 rounded-2xl font-semibold text-red-600 border-red-200 hover:bg-red-50"
              onClick={logout}
              disabled={isLoggingOut}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {isLoggingOut ? t("loggingOut") : t("logout")}
            </Button>
          </div>

          {/* Legal links */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-4 text-sm">
            <button
              onClick={() => setLocation("/terms")}
              className="text-muted-foreground hover:text-gray-700 underline"
              data-testid="link-profile-terms"
            >
              {t("termsOfUse")}
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => setLocation("/privacy")}
              className="text-muted-foreground hover:text-gray-700 underline"
              data-testid="link-profile-privacy"
            >
              {t("privacyPolicy")}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <Navigation />
    </>
  );
}
