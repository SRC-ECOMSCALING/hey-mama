import type { ReactNode } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import NotificationIcon from "@/components/notification-icon";
import { useLanguage } from "@/contexts/LanguageContext";
import heyMamaLogo from "@assets/logo_gradient_text-min_1757514869714.png";

interface AppHeaderProps {
  // Left action: back arrow (default), settings gear, or custom node
  left?: "back" | "settings" | ReactNode;
  // Back destination (default home)
  backTo?: string;
  // Right action: defaults to the events calendar icon
  right?: ReactNode;
  // Floating variant used on top of the map
  floating?: boolean;
}

// The ONE header shared by every page: glass bar, centered logo, an action on
// each side. Keeps the app visually consistent from screen to screen.
export default function AppHeader({ left = "back", backTo = "/", right, floating = false }: AppHeaderProps) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const leftNode =
    left === "back" ? (
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label={t("back")}
        onClick={() => (backTo === "history" ? window.history.back() : setLocation(backTo))}
        data-testid="button-back"
      >
        <ArrowLeft className="h-5 w-5 text-gray-600" />
      </Button>
    ) : left === "settings" ? (
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label={t("settingsTitle")}
        onClick={() => setLocation("/settings")}
        data-testid="button-settings"
      >
        <Settings className="h-5 w-5 text-gray-600" />
      </Button>
    ) : (
      left
    );

  const inner = (
    <div className="flex items-center justify-between p-4">
      <div className="w-10 flex justify-start">{leftNode}</div>
      <img src={heyMamaLogo} alt="HeyMama" className="h-10 w-auto object-contain" />
      <div className="w-10 flex justify-end">{right === undefined ? <NotificationIcon /> : right}</div>
    </div>
  );

  if (floating) {
    return (
      <header className="absolute left-4 right-4 bg-white/90 backdrop-blur-xl shadow-lg rounded-2xl z-50 top-[calc(1rem_+_env(safe-area-inset-top))]">
        {inner}
      </header>
    );
  }

  return (
    <header className="bg-white/85 backdrop-blur-xl shadow-sm sticky top-0 z-50">
      {inner}
    </header>
  );
}
