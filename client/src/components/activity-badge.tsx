import type { ActivityBand } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";

interface ActivityBadgeProps {
  isOnline?: boolean | null;
  activityBand?: ActivityBand;
  className?: string;
}

// Honest, coarse presence: "online" (last 5 minutes), "active today",
// "active this week", or nothing. Never an exact time, never padded.
export default function ActivityBadge({ isOnline, activityBand, className = "" }: ActivityBadgeProps) {
  const { t } = useLanguage();
  let label: string | null = null;
  let color = "text-gray-500 bg-gray-100";
  if (isOnline) {
    label = t("online");
    color = "text-green-700 bg-green-50";
  } else if (activityBand === "today") {
    label = t("activeToday");
    color = "text-green-700 bg-green-50";
  } else if (activityBand === "week") {
    label = t("activeThisWeek");
    color = "text-amber-700 bg-amber-50";
  }
  if (!label) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${color} ${className}`}
      data-testid="activity-badge"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-500" : activityBand === "today" ? "bg-green-400" : "bg-amber-400"}`} />
      {label}
    </span>
  );
}
