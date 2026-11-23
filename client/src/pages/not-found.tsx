import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="safe-page flex min-h-screen w-full flex-col items-center justify-center bg-gray-50 px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 text-pink-500" aria-hidden="true">
        <Compass className="h-7 w-7" />
      </span>
      <h1 className="mt-5 font-display text-xl font-semibold text-gray-900">{t("notFoundTitle")}</h1>
      <p className="mt-2 max-w-xs text-pretty text-gray-600">{t("pageNotFoundMessage")}</p>
      <Button onClick={() => setLocation("/")} className="mt-6" data-testid="button-go-home">
        {t("goHome")}
      </Button>
    </div>
  );
}
