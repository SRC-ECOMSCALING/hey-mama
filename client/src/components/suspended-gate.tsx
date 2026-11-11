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
    <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center">
          <Ban className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t("suspendedTitle")}</h1>
        <p className="text-gray-600">{t("suspendedDescription")}</p>
        {user.suspendedReason && (
          <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">
            <span className="font-semibold">{t("suspendedReasonLabel")}:</span> {user.suspendedReason}
          </p>
        )}
        <p className="text-sm text-gray-500">
          {fill(t("suspendedAppeal"), { email: "" })}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-pink-600 underline">{SUPPORT_EMAIL}</a>
        </p>
        <Button variant="outline" onClick={logout} disabled={isLoggingOut} data-testid="button-suspended-logout">
          <LogOut className="h-4 w-4 mr-2" />
          {t("logout")}
        </Button>
      </div>
    </div>
  );
}
