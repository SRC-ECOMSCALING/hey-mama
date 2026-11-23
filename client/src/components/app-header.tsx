import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import NotificationIcon from "@/components/notification-icon";
import { useLanguage } from "@/contexts/LanguageContext";

interface AppHeaderProps {
  // Page title. Tab roots use the large display title; pushed pages a compact one.
  title?: string;
  // Left action: "back" arrow, nothing (tab roots), or a custom node.
  left?: "back" | "none" | ReactNode;
  // Back destination (default: previous page, falling back to home)
  backTo?: string;
  // Right action: defaults to the notifications bell; pass null to hide it.
  right?: ReactNode;
  // Keep the bar pinned while the page scrolls (default true)
  sticky?: boolean;
  className?: string;
}

// The one header shared by every page. Two shapes:
//   <AppHeader title="Eventi" left="none" right={…} />   tab root: big title
//   <AppHeader title="Notifiche" />                      pushed page: back + title
export default function AppHeader({ title, left = "back", backTo = "history", right, sticky = true, className = "" }: AppHeaderProps) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const isRoot = left === "none";

  const goBack = () => {
    if (backTo !== "history") return setLocation(backTo);
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };

  const leftNode =
    left === "back" ? (
      <button type="button" className="icon-btn" aria-label={t("back")} onClick={goBack} data-testid="button-back">
        <ArrowLeft className="h-5 w-5" />
      </button>
    ) : isRoot ? null : (
      left
    );

  return (
    <header
      className={`${sticky ? "sticky top-0" : ""} z-40 bg-gray-50/85 px-5 pb-3 backdrop-blur-xl ${className}`}
      style={{ paddingTop: "calc(0.875rem + env(safe-area-inset-top))" }}
    >
      <div className="flex min-h-12 items-center gap-3">
        {leftNode}
        {title ? (
          isRoot ? (
            <h1 className="page-title min-w-0 flex-1 truncate">{title}</h1>
          ) : (
            <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-semibold leading-none tracking-tight text-gray-900">{title}</h1>
          )
        ) : (
          <span className="flex-1" />
        )}
        {right === undefined ? <NotificationIcon /> : right}
      </div>
    </header>
  );
}
