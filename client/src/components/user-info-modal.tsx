import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink, Instagram } from "lucide-react";
import type { Profile } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";
import ReportBlockControls from "@/components/report-block";
import PhotoCarousel from "@/components/photo-carousel";
import ActivityBadge from "@/components/activity-badge";
import type { PublicProfile } from "@shared/schema";
import { instagramHandle } from "@shared/instagram";

interface UserInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: (Profile & Partial<PublicProfile>) | null;
}

export default function UserInfoModal({ open, onOpenChange, profile }: UserInfoModalProps) {
  const { t } = useLanguage();
  if (!profile) return null;

  const fresh = !!profile.isOnline || profile.activityBand === "today";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3.5 pr-6 text-left">
            <span
              className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pink-100 text-2xl font-semibold text-gray-900 ${
                fresh ? "ring-online" : ""
              }`}
            >
              {profile.photoUrls?.[0] ? (
                <img
                  src={profile.photoUrls[0]}
                  alt={`${profile.firstName} ${profile.lastName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                profile.firstName?.charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold leading-tight">{profile.firstName} {profile.lastName}</div>
              {profile.age != null && (
                <div className="mt-1 font-sans text-sm font-normal tracking-normal text-gray-600">{profile.age} {t("yearsOld")}</div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Every photo, not just the first */}
          {(profile.photoUrls?.length ?? 0) > 1 && (
            <PhotoCarousel photos={profile.photoUrls} alt={profile.firstName} className="h-56" rounded="rounded-3xl" />
          )}

          {/* Location + activity */}
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 items-center gap-1.5 font-medium text-gray-600">
              <MapPin className="h-[15px] w-[15px] shrink-0" />
              <span className="truncate">{profile.location}</span>
            </div>
            <ActivityBadge isOnline={profile.isOnline} activityBand={profile.activityBand} />
          </div>

          {/* Kids Info */}
          {(profile.kidsAges?.length ?? 0) > 0 && (
            <div>
              <h3 className="section-label font-sans tracking-normal">{t("kids")}</h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {profile.kidsAges?.map((age, index) => (
                  <span
                    key={index}
                    className="inline-flex h-8 items-center rounded-full bg-purple-50 px-3 text-[13px] font-semibold text-purple-700"
                  >
                    {t("age")} {age} {profile.kidsGenders?.[index] ? `(${profile.kidsGenders[index]})` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hobbies */}
          {(profile.hobbies?.length ?? 0) > 0 && (
            <div>
              <h3 className="section-label font-sans tracking-normal">{t("interests")}</h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {profile.hobbies?.map((hobby, index) => (
                  <span
                    key={index}
                    className="inline-flex h-8 items-center rounded-full bg-gray-100 px-3 text-[13px] font-medium text-gray-900"
                  >
                    {hobby}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <div>
              <h3 className="section-label font-sans tracking-normal">{t("about")}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-800">{profile.bio}</p>
            </div>
          )}

          {/* Vinted Account */}
          {profile.vintedUrl && (
            <div>
              <h3 className="section-label font-sans tracking-normal">{t("vintedAccount")}</h3>
              <Button
                variant="outline"
                onClick={() => window.open(profile.vintedUrl || '', '_blank')}
                className="mt-2.5 w-full justify-between"
                data-testid="button-vinted-link"
              >
                <span>{t("viewVintedProfile")}</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Instagram */}
          {profile.instagramUrl && (
            <div>
              <h3 className="section-label font-sans tracking-normal">Instagram</h3>
              <Button
                asChild
                variant="outline"
                className="mt-2.5 w-full justify-between"
              >
                <a
                  href={profile.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-instagram"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Instagram className="h-4 w-4 shrink-0" />
                    <span className="truncate">{instagramHandle(profile.instagramUrl)}</span>
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          )}

          {/* Report / block (App Store 1.2) */}
          <ReportBlockControls
            targetUserId={profile.userId}
            targetType="profile"
            targetId={profile.id}
            onBlocked={() => onOpenChange(false)}
            className="border-t border-gray-100 pt-4"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
