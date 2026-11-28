import type { ReactNode } from "react";
import { ExternalLink, Instagram, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { instagramHandle } from "@shared/instagram";

// Compact rows that open a mom's Vinted and Instagram profiles, used inside the
// profile sheets (map sheet and "how others see me" preview).
function LinkRow({ href, icon, label, testId }: { href: string; icon: ReactNode; label: string; testId: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 items-center gap-2.5 rounded-2xl bg-gray-100 px-3.5 text-[15px] font-medium text-gray-900"
      data-testid={testId}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ExternalLink className="h-4 w-4 shrink-0 text-gray-500" />
    </a>
  );
}

export default function ProfileLinks({
  vintedUrl,
  instagramUrl,
  className = "",
}: {
  vintedUrl?: string | null;
  instagramUrl?: string | null;
  className?: string;
}) {
  const { t } = useLanguage();
  // Vinted links are free text typed by users: only open real web links.
  if (vintedUrl && !/^https?:\/\//i.test(vintedUrl.trim())) vintedUrl = null;
  if (!vintedUrl && !instagramUrl) return null;
  const iconClass = "h-[18px] w-[18px] shrink-0";
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {vintedUrl && (
        <LinkRow
          href={vintedUrl.trim()}
          icon={<ShoppingBag className={iconClass} strokeWidth={1.9} />}
          label={t("vintedAccount")}
          testId="link-vinted"
        />
      )}
      {instagramUrl && (
        <LinkRow
          href={instagramUrl}
          icon={<Instagram className={iconClass} strokeWidth={1.9} />}
          label={instagramHandle(instagramUrl)}
          testId="link-instagram"
        />
      )}
    </div>
  );
}
