import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Briefcase, MapPin, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReportBlockControls from "@/components/report-block";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Profile, Service } from "@shared/schema";

interface ProfessionalWithServices extends Profile {
  services: Service[];
}

// Local professional accounts with the services they offer. Shown as the
// "Professionisti" layer of Esplora.
export default function ProfessionalsList() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const { data: professionals = [], isLoading } = useQuery<ProfessionalWithServices[]>({
    queryKey: ["/api/professionals"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-28 rounded-3xl skeleton-shimmer" />
        ))}
      </div>
    );
  }

  if (professionals.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
          <Briefcase className="h-7 w-7 text-pink-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{t("noProfessionalsYet")}</h3>
        <p className="mx-auto mt-1 max-w-xs text-sm text-gray-600">{t("professionalsIntro")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {professionals.map((pro) => {
        const displayName = pro.businessName || `${pro.firstName} ${pro.lastName}`.trim();
        const firstService = pro.services[0];
        return (
          <article key={pro.id} className="rounded-3xl bg-white p-4" data-testid={`professional-card-${pro.id}`}>
            <div className="flex gap-3">
              {pro.photoUrls?.[0] ? (
                <img
                  src={pro.photoUrls[0]}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-[20px] object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-purple-50">
                  <Briefcase className="h-7 w-7 text-purple-700" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-gray-900">{displayName}</h3>
                {pro.professionalCategory && <span className="tag-violet mt-1">{pro.professionalCategory}</span>}
                {pro.location && (
                  <p className="mt-1 flex items-center gap-1 text-[13px] text-gray-600">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{pro.location}</span>
                  </p>
                )}
              </div>
              <ReportBlockControls
                targetUserId={pro.userId}
                targetType="profile"
                targetId={pro.id}
                variant="icons"
                className="-mr-2 -mt-1 shrink-0"
              />
            </div>

            {pro.bio && <p className="mt-3 line-clamp-2 text-sm text-gray-700">{pro.bio}</p>}

            {pro.services.length > 0 && (
              <div className="mt-3">
                <p className="section-label mb-2">{t("servicesOffered")}</p>
                <div className="space-y-1.5">
                  {pro.services.slice(0, 3).map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-gray-800">{s.title}</span>
                      {s.hourlyRate != null && (
                        <span className="shrink-0 font-display font-semibold text-gray-900">
                          €{(s.hourlyRate / 100).toFixed(0)}
                          {t("perHour")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {firstService && (
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => setLocation(`/market-chat/service:${firstService.id}/${pro.userId}`)}
                data-testid={`button-contact-${pro.id}`}
              >
                <MessageCircle className="h-4 w-4" />
                {t("contact")}
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
}
