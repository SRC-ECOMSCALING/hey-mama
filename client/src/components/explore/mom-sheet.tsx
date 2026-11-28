import { useEffect, useState } from "react";
import { Check, Heart, Loader2, MapPin, Send, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import ActivityBadge from "@/components/activity-badge";
import PhotoCarousel from "@/components/photo-carousel";
import PhotoOrInitial from "@/components/photo-or-initial";
import ReportBlockControls from "@/components/report-block";
import InstagramLink from "@/components/instagram-link";
import { useLanguage } from "@/contexts/LanguageContext";
import { fill } from "@/lib/format";
import type { TranslationKey } from "@/lib/translations";
import type { PublicProfile } from "@shared/schema";

export type MomConnectionState = "none" | "pending" | "connected" | "cooldown";

type Translate = (key: TranslationKey) => string;

const parseAge = (age: string): number | null => {
  const n = parseFloat(String(age).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

// How a kid's age reads on a chip ("2 anni", "Meno di 1 anno"); unparsable
// values are shown as stored.
export const kidAgeLabel = (t: Translate, age: string): string => {
  const n = parseAge(age);
  if (n == null) return age;
  if (n < 1) return t("momKidBaby");
  const years = Math.round(n);
  return years === 1 ? t("kidAgeOne") : fill(t("momKidAge"), { age: years });
};

// What the viewer shares with another mom: kids of the same age and
// interests in common. Computed on the client from data both already show.
export function commonGround(
  t: Translate,
  me: Pick<PublicProfile, "kidsAges" | "hobbies"> | null | undefined,
  other: Pick<PublicProfile, "kidsAges" | "hobbies">,
): string[] {
  if (!me) return [];
  const mine = new Set((me.kidsAges ?? []).map(parseAge).filter((n): n is number => n != null).map((n) => Math.floor(n)));
  const ages = Array.from(
    new Set((other.kidsAges ?? []).map(parseAge).filter((n): n is number => n != null).map((n) => Math.floor(n))),
  )
    .filter((n) => mine.has(n))
    .sort((a, b) => a - b);
  const ageLabels = ages.map((n) =>
    n < 1 ? t("commonKidsBaby") : n === 1 ? t("commonKidsAgeOne") : fill(t("commonKidsAge"), { age: n }),
  );
  const myHobbies = new Set((me.hobbies ?? []).map((h) => h.trim().toLowerCase()));
  const hobbies = (other.hobbies ?? []).filter((h) => myHobbies.has(h.trim().toLowerCase()));
  return [...ageLabels, ...hobbies];
}

interface MomSheetProps {
  profile: PublicProfile | null;
  // The viewer's own profile, for "in common with you"
  me: PublicProfile | null | undefined;
  state: MomConnectionState;
  // She already asked the viewer: the main button accepts instead
  incoming: boolean;
  isSending: boolean;
  onClose: () => void;
  onSend: (message?: string) => void;
}

// Bottom sheet with a mom's profile and, one tap later, the connection
// request with an optional note.
export default function MomSheet({ profile, me, state, incoming, isSending, onClose, onSend }: MomSheetProps) {
  const { t } = useLanguage();
  const [view, setView] = useState<"profile" | "request">("profile");
  const [message, setMessage] = useState("");

  // A new profile always opens on its first view with an empty note
  useEffect(() => {
    setView("profile");
    setMessage("");
  }, [profile?.id]);

  // Keep the last profile while the sheet animates out
  const [shown, setShown] = useState<PublicProfile | null>(profile);
  useEffect(() => {
    if (profile) setShown(profile);
  }, [profile]);
  const p = profile ?? shown;

  const common = p ? commonGround(t, me, p) : [];
  const commonSet = new Set(common.map((c) => c.toLowerCase()));
  const otherHobbies = p ? (p.hobbies ?? []).filter((h) => !commonSet.has(h.toLowerCase())) : [];

  const buttonLabel =
    state === "connected"
      ? t("connected")
      : incoming
        ? t("accept")
        : state === "pending"
          ? t("requestPending")
          : state === "cooldown"
            ? t("requestNotAvailable")
            : t("askToConnect");
  const buttonDisabled = isSending || state === "connected" || state === "cooldown" || (state === "pending" && !incoming);

  const prompts: TranslationKey[] = ["requestPromptKids", "requestPromptCoffee", "requestPromptNear"];

  return (
    <Drawer open={!!profile} onOpenChange={(open) => !open && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="h-[92dvh]" data-testid="mom-sheet">
        {p && view === "profile" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
              <div className="relative">
                <PhotoCarousel photos={p.photoUrls} alt={p.firstName} className="h-[300px]" rounded="rounded-[28px]" />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("close")}
                  className="glass absolute right-3 top-7 flex h-11 w-11 items-center justify-center rounded-full text-gray-900"
                  data-testid="button-close-profile-popup"
                >
                  <X className="h-5 w-5" />
                </button>
                <ActivityBadge
                  isOnline={p.isOnline}
                  activityBand={p.activityBand}
                  className="glass absolute bottom-3 left-3 !h-[30px] !bg-white/70 !text-gray-900"
                />
              </div>

              <div className="mt-5 flex items-start justify-between gap-3 px-1">
                <div className="min-w-0">
                  <DrawerTitle className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
                    {p.firstName}
                    {p.age != null ? `, ${p.age}` : ""}
                  </DrawerTitle>
                  <DrawerDescription className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-600">
                    <MapPin className="h-[15px] w-[15px] shrink-0" />
                    <span className="truncate">
                      {p.location}
                      {p.kidsNumber > 0
                        ? ` · ${p.kidsNumber === 1 ? t("momOfOne") : fill(t("momOfMany"), { count: p.kidsNumber })}`
                        : ""}
                    </span>
                  </DrawerDescription>
                </div>
                <ReportBlockControls
                  targetUserId={p.userId}
                  targetType="profile"
                  targetId={p.id}
                  variant="icons"
                  className="shrink-0"
                  onBlocked={onClose}
                />
              </div>

              {common.length > 0 && (
                <section className="mt-4 rounded-[20px] bg-pink-50 p-3.5" aria-label={t("commonTitle")}>
                  <h3 className="font-sans text-[13px] font-semibold leading-none tracking-normal text-pink-700">{t("commonTitle")}</h3>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {common.map((c) => (
                      <span key={c} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white pl-2.5 pr-3 text-[13px] font-semibold text-gray-900">
                        <Check className="h-3.5 w-3.5 text-pink-500" strokeWidth={2.6} />
                        {c}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {(p.kidsAges.length > 0 || otherHobbies.length > 0) && (
                <section className="mt-4 px-1">
                  <h3 className="section-label font-sans tracking-normal">{t("momKidsAndInterests")}</h3>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {p.kidsAges.map((age, i) => (
                      <span key={`kid-${i}`} className="inline-flex h-8 items-center rounded-full bg-purple-50 px-3 text-[13px] font-semibold text-purple-700">
                        {kidAgeLabel(t, age)}
                      </span>
                    ))}
                    {otherHobbies.map((hobby) => (
                      <span key={hobby} className="inline-flex h-8 items-center rounded-full bg-gray-100 px-3 text-[13px] font-medium text-gray-900">
                        {hobby}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {p.bio && <p className="mt-4 px-1 text-[15px] leading-relaxed text-gray-800">{p.bio}</p>}
              {p.instagramUrl && <InstagramLink url={p.instagramUrl} className="mt-4" />}
            </div>

            <div className="px-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] pt-2">
              <Button
                size="lg"
                className="w-full"
                disabled={buttonDisabled}
                onClick={() => (incoming ? onSend() : setView("request"))}
                data-testid="button-connect"
              >
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-[18px] w-[18px]" />}
                {buttonLabel}
              </Button>
            </div>
          </div>
        )}

        {p && view === "request" && (
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-center gap-3.5">
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pink-100 font-display text-xl font-semibold text-gray-900 ${
                  p.isOnline || p.activityBand === "today" ? "ring-online" : ""
                }`}
              >
                <PhotoOrInitial src={p.photoUrls?.[0]} name={p.firstName} />
              </span>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-[21px] leading-tight">{fill(t("requestTitle"), { name: p.firstName })}</DrawerTitle>
                <DrawerDescription className="mt-1 text-sm text-gray-600">{t("requestSubtitle")}</DrawerDescription>
              </div>
              <button
                type="button"
                onClick={() => setView("profile")}
                aria-label={t("back")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-900"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="mt-5">
              <h3 className="section-label font-sans tracking-normal">{t("requestPromptsLabel")}</h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {prompts.map((key) => {
                  const text = t(key);
                  const on = message === text;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setMessage(on ? "" : text)}
                      className={`chip h-11 bg-gray-50 font-semibold ${on ? "chip-on" : ""}`}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="request-note" className="section-label">
                {t("requestYourMessage")}
              </label>
              <Textarea
                id="request-note"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                placeholder={t("requestMessagePlaceholder")}
                rows={4}
                className="mt-2 resize-none"
                data-testid="input-request-message"
              />
              <p className="mt-1 text-right text-xs text-gray-500">{message.length}/300</p>
            </div>

            <p className="mt-2 flex items-start gap-2.5 text-[13px] leading-snug text-gray-600">
              <ShieldCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-purple-600" />
              <span>{fill(t("requestPrivacyNote"), { name: p.firstName })}</span>
            </p>

            <div className="mt-auto space-y-1 pt-4">
              <Button size="lg" className="w-full" disabled={isSending} onClick={() => onSend(message)} data-testid="button-send-request">
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {t("sendRequest")}
                    <Send className="h-[18px] w-[18px]" />
                  </>
                )}
              </Button>
              {message.trim() !== "" && (
                <Button variant="ghost" className="w-full text-gray-600" disabled={isSending} onClick={() => onSend()}>
                  {t("requestSendWithout")}
                </Button>
              )}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
