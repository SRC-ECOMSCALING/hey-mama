import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

interface NotificationIconProps {
  className?: string;
}

// Header icon: community events (replaces the old notifications bell).
export default function NotificationIcon({ className = "" }: NotificationIconProps) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("events")}
      title={t("events")}
      className={`relative rounded-full ${className}`}
      onClick={() => setLocation("/events")}
      data-testid="button-events"
    >
      <CalendarDays className="h-5 w-5 text-gray-600" />
    </Button>
  );
}
