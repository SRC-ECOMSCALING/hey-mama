import type { ActivityBand } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";

interface ActivityBadgeProps {
  isOnline?: boolean | null;
  activityBand?: ActivityBand;
  className?: string;
  // "pill" (default) is a tinted label; "text" is just the coloured words
  variant?: "pill" | "text";
}

// Honest, coarse presence: "online" (last 5 minutes), "active today",
// "active this week", or nothing. Never an exact time, never padded.
export default function ActivityBadge({ isOnline, activityBand, className = "", variant = "pill" }: ActivityBadgeProps) {
  const { t } = useLanguage();
  let label: string | null = null;
  const fresh = !!isOnline || activityBand === "today";
  if (isOnline) label = t("online");
  else if (activityBand === "today") label = t("activeToday");
  else if (activityBand === "week") label = t("activeThisWeek");
  if (!label) return null;

  if (variant === "text") {
    return (
      <span className={`text-[11px] leading-none ${fresh ? "font-semibold text-pink-700" : "font-medium text-gray-600"} ${className}`} data-testid="activity-badge">
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold ${
        fresh ? "bg-pink-50 text-pink-700" : "bg-gray-100 text-gray-600"
      } ${className}`}
      data-testid="activity-badge"
    >
      <span className={`h-2 w-2 rounded-full ${fresh ? "bg-pink-500" : "bg-gray-400"}`} />
      {label}
    </span>
  );
}
