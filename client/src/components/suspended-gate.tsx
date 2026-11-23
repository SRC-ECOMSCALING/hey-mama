import { Ban, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { fill } from "@/lib/format";

const SUPPORT_EMAIL = "support@heymama.app";

// Full-screen notice for suspended accounts: the reason, the appeal address
// and a way out (logout). Every other API call is refused server-side.
export default function SuspendedGate() {
  const { user, logout, isLoggingOut } = useAuth();
  const { t } = useLanguage();
  if (!user?.suspended) return null;

  return (
    <div className="safe-page fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-gray-50 px-6" role="alertdialog" aria-modal="true" aria-labelledby="suspended-title">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-destructive shadow-[0_8px_24px_rgba(23,17,31,0.05)]" aria-hidden="true">
          <Ban className="h-7 w-7" />
        </div>
        <h1 id="suspended-title" className="font-display text-2xl font-semibold tracking-[-0.02em] text-gray-900">{t("suspendedTitle")}</h1>
        <p className="text-pretty text-gray-600">{t("suspendedDescription")}</p>
        {user.suspendedReason && (
          <p className="card-float w-full p-4 text-left text-sm leading-relaxed text-gray-800">
            <span className="font-semibold">{t("suspendedReasonLabel")}:</span> {user.suspendedReason}
          </p>
        )}
        <p className="text-sm leading-relaxed text-gray-600">
          {fill(t("suspendedAppeal"), { email: "" })}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-pink-700 underline">{SUPPORT_EMAIL}</a>
        </p>
        <Button variant="outline" className="mt-2" onClick={logout} disabled={isLoggingOut} data-testid="button-suspended-logout">
          <LogOut />
          {t("logout")}
        </Button>
      </div>
    </div>
  );
}
