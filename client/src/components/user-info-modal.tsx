import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Heart, ExternalLink, ShoppingBag } from "lucide-react";
import type { Profile } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";

interface UserInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
}

export default function UserInfoModal({ open, onOpenChange, profile }: UserInfoModalProps) {
  const { t } = useLanguage();
  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img
              src={profile.photoUrls?.[0] || "https://via.placeholder.com/100"}
              alt={`${profile.firstName} ${profile.lastName}`}
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <div className="text-xl font-bold">{profile.firstName} {profile.lastName}</div>
              {profile.age != null && <div className="text-sm text-muted-foreground font-normal">{profile.age} {t("yearsOld")}</div>}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Location */}
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">{profile.location}</span>
          </div>

          {/* Kids Info */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("kids")}
            </h3>
            <div className="flex gap-2 flex-wrap">
              {profile.kidsAges?.map((age, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="px-3 py-1"
                  style={{ 
                    backgroundColor: index % 2 === 0 ? "rgba(244, 166, 205, 0.2)" : "rgba(135, 206, 235, 0.2)",
                    color: index % 2 === 0 ? "var(--primary-pink)" : "var(--primary-blue)"
                  }}
                >
                  {t("age")} {age} {profile.kidsGenders?.[index] ? `(${profile.kidsGenders[index]})` : ''}
                </Badge>
              ))}
            </div>
          </div>

          {/* Hobbies */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Heart className="h-4 w-4" />
              {t("interests")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.hobbies?.map((hobby, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-sm"
                >
                  {hobby}
                </Badge>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">{t("about")}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{profile.bio}</p>
          </div>

          {/* Vinted Account */}
          {profile.vintedUrl && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                {t("vintedAccount")}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(profile.vintedUrl || '', '_blank')}
                className="w-full justify-between"
                data-testid="button-vinted-link"
              >
                <span>{t("viewVintedProfile")}</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
