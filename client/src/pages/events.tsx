import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  CalendarDays, CalendarCheck, History, Plus, MapPin, ExternalLink, Trash2,
  Clock, Globe, Lock, Loader2, Check, HelpCircle, Briefcase, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { fill } from "@/lib/format";
import AppHeader from "@/components/app-header";
import GooglePlacesAutocomplete from "@/components/google-places-autocomplete";
import ReportBlockControls from "@/components/report-block";

interface Attendee {
  userId: string;
  firstName: string;
  photoUrl: string | null;
  status: "going" | "maybe";
}

interface EventItem {
  id: string;
  createdByUserId: string;
  title: string;
  description: string;
  eventDate: string;
  location: string;
  link: string | null;
  latitude: string | null;
  longitude: string | null;
  visibility: "public" | "private";
  status: "pending" | "approved" | "rejected";
  isOwn: boolean;
  creatorName: string;
  creatorPhotoUrl: string | null;
  creatorIsProfessional?: boolean;
  rsvp: { going: number; maybe: number; mine: "going" | "maybe" | null; attendees: Attendee[] };
}

type EventFilter = "upcoming" | "mine" | "past";

const EMPTY_FORM = {
  title: "",
  description: "",
  eventDate: "",
  location: "",
  link: "",
  visibility: "public" as "public" | "private",
  latitude: "" as string,
  longitude: "" as string,
};

export default function Events() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filter, setFilter] = useState<EventFilter>("upcoming");
  // One event at a time shows its details (description, link, secondary actions)
  const [openId, setOpenId] = useState<string | null>(null);
  // "Propose a meetup" from a chat: ?create=1&with=<name>&matchId=<id>
  const [proposalMatchId, setProposalMatchId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") {
      const withName = params.get("with") || "";
      const matchId = params.get("matchId");
      setForm({
        ...EMPTY_FORM,
        title: withName ? fill(t("meetupWith"), { name: withName }) : "",
        visibility: matchId ? "private" : "public",
      });
      setProposalMatchId(matchId);
      setCreateOpen(true);
      // Clean the URL so a refresh doesn't reopen the dialog
      window.history.replaceState(null, "", "/events");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: eventSettings } = useQuery<{ autoApprove: boolean }>({
    queryKey: ["/api/events/settings"],
  });

  const { data: events = [], isLoading } = useQuery<EventItem[]>({
    queryKey: ["/api/events"],
  });

  const locale = language === "it" ? "it-IT" : "en-GB";

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(locale, {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  // "Sabato 29 novembre"
  const formatLongDay = (iso: string) => {
    const s = new Date(iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const weekdayShort = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { weekday: "short" }).replace(".", "");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/events", {
        title: form.title.trim(),
        description: form.description.trim(),
        eventDate: new Date(form.eventDate).toISOString(),
        location: form.location.trim(),
        link: form.link.trim() || null,
        visibility: form.visibility,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
      });
      return res.json();
    },
    onSuccess: async (event: EventItem) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM });
      toast({
        title: t("eventCreatedTitle"),
        description: event.status === "approved" ? t("eventCreatedAdminDesc") : t("eventCreatedDesc"),
      });
      // A meetup proposed from a chat is announced in that chat too
      if (proposalMatchId) {
        const matchId = proposalMatchId;
        setProposalMatchId(null);
        try {
          await apiRequest("POST", "/api/messages", {
            matchId,
            senderId: "temp",
            content: fill(t("meetupProposedMessage"), {
              title: event.title,
              date: formatDate(event.eventDate),
              place: event.location,
            }),
          });
          queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
          setLocation(`/chat/${matchId}`);
        } catch {
          /* the event exists either way */
        }
      }
    },
    onError: () => {
      toast({ title: t("error"), description: t("eventErrorCreate"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: t("eventDeleted") });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "going" | "maybe" | null }) => {
      if (status === null) return apiRequest("DELETE", `/api/events/${id}/rsvp`);
      return apiRequest("POST", `/api/events/${id}/rsvp`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.eventDate) >= now);
  const past = events.filter((e) => new Date(e.eventDate) < now);

  // "I miei": events I organise or answered (going / maybe)
  const isMine = (e: EventItem) => e.isOwn || (e.rsvp?.mine ?? null) !== null;
  const mineUpcoming = upcoming.filter(isMine);
  const minePast = past.filter(isMine);

  // Highlight card: the nearest upcoming event I'm going to or organise
  const nextMine =
    upcoming
      .filter((e) => e.status === "approved" && (e.isOwn || e.rsvp?.mine === "going"))
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0] ?? null;
  const upcomingList = nextMine ? upcoming.filter((e) => e.id !== nextMine.id) : upcoming;

  const statusTag = (event: EventItem) => {
    if (event.status === "pending") {
      return <span className="tag-neutral"><Clock className="h-3 w-3" />{t("statusPending")}</span>;
    }
    if (event.status === "rejected") {
      return (
        <span className="inline-flex h-7 items-center gap-1 rounded-full bg-red-50 px-2.5 text-[11px] font-semibold text-destructive">
          {t("statusRejected")}
        </span>
      );
    }
    return <span className="tag-pink"><Check className="h-3 w-3" />{t("statusApproved")}</span>;
  };

  const visibilityTag = (event: EventItem) => (
    event.visibility === "private" ? (
      <span className="tag-violet"><Lock className="h-3 w-3" />{t("privateEvent")}</span>
    ) : (
      <span className="tag-neutral"><Globe className="h-3 w-3" />{t("publicEvent")}</span>
    )
  );

  // "4 partecipano · 1 forse" / "Sii la prima a partecipare"
  const attendanceText = (event: EventItem, isPast: boolean) => {
    const going = event.rsvp?.going ?? 0;
    const maybe = event.rsvp?.maybe ?? 0;
    const parts: string[] = [];
    if (going > 0) parts.push(fill(t("rsvpGoingCount"), { count: going }));
    else if (!isPast) parts.push(t("rsvpNobodyYet"));
    if (maybe > 0) parts.push(fill(t("rsvpMaybeCount"), { count: maybe }));
    return parts.join(" · ");
  };

  const isBusy = (event: EventItem) => rsvpMutation.isPending && rsvpMutation.variables?.id === event.id;

  // Main RSVP control: "Partecipo" when not going, "Ci sarò" (tap again to
  // withdraw) when going.
  const rsvpPill = (event: EventItem, onTint = false) => {
    const busy = isBusy(event);
    if (event.rsvp?.mine === "going") {
      return (
        <button
          type="button"
          aria-pressed="true"
          disabled={busy}
          onClick={() => rsvpMutation.mutate({ id: event.id, status: null })}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-pink-500 pl-3 pr-4 text-[13px] font-semibold text-white disabled:opacity-60"
          data-testid={`button-rsvp-cancel-${event.id}`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.8} />}
          {t("rsvpImIn")}
        </button>
      );
    }
    return (
      <button
        type="button"
        aria-pressed="false"
        disabled={busy}
        onClick={() => rsvpMutation.mutate({ id: event.id, status: "going" })}
        className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-pink-700 disabled:opacity-60 ${onTint ? "bg-white" : "bg-pink-50"}`}
        data-testid={`button-rsvp-going-${event.id}`}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("rsvpJoin")}
      </button>
    );
  };

  // Everything beyond the summary row: full date and place, description,
  // labels, link, who is coming, "maybe", delete / report / block.
  const eventDetails = (event: EventItem, isPast: boolean, opts: { whenWhere: boolean; organiser: boolean }) => {
    const mine = event.rsvp?.mine ?? null;
    const attendees = event.rsvp?.attendees ?? [];
    const attendance = attendanceText(event, isPast);
    const busy = isBusy(event);
    const canRsvp = !isPast && event.status === "approved";
    const pinned = Boolean(event.latitude && event.longitude);
    return (
      <div id={`event-details-${event.id}`} className="space-y-3.5">
        {(opts.whenWhere || pinned) && (
          <div className="space-y-1.5 text-[13px] text-gray-600">
            {opts.whenWhere && (
              <>
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{formatDate(event.eventDate)}</span>
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{event.location}</span>
                </p>
              </>
            )}
            {pinned && (
              <button
                type="button"
                className={`inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-purple-700 ${opts.whenWhere ? "pl-6" : ""}`}
                onClick={() => setLocation("/")}
                data-testid={`button-event-on-map-${event.id}`}
              >
                {!opts.whenWhere && <MapPin className="h-4 w-4" aria-hidden="true" />}
                {t("eventPlacePinned")}
              </button>
            )}
          </div>
        )}

        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">{event.description}</p>

        <div className="flex flex-wrap items-center gap-2">
          {visibilityTag(event)}
          {event.creatorIsProfessional && (
            <span className="tag-neutral"><Briefcase className="h-3 w-3" />{t("commercialEvent")}</span>
          )}
          {(event.isOwn || event.status !== "approved") && statusTag(event)}
        </div>

        {event.link && (
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-pink-700"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />{t("openLink")}
          </a>
        )}

        {/* Who else is coming */}
        {(attendees.length > 0 || attendance) && (
          <div className="flex items-center gap-2.5">
            {attendees.length > 0 && (
              <div className="flex shrink-0 -space-x-2">
                {attendees.slice(0, 5).map((a) => (
                  a.photoUrl ? (
                    <img
                      key={a.userId}
                      src={a.photoUrl}
                      alt={a.firstName}
                      title={a.firstName}
                      className={`h-8 w-8 rounded-full object-cover ring-2 ring-white ${a.status === "maybe" ? "opacity-60" : ""}`}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      key={a.userId}
                      title={a.firstName}
                      className={`flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 font-display text-xs font-semibold text-gray-900 ring-2 ring-white ${a.status === "maybe" ? "opacity-60" : ""}`}
                    >
                      {a.firstName?.[0] ?? "?"}
                    </div>
                  )
                ))}
              </div>
            )}
            {attendance && <span className="min-w-0 text-xs font-medium text-gray-600">{attendance}</span>}
          </div>
        )}

        {canRsvp && (
          mine === "going" ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3.5 h-11 rounded-full text-gray-600"
              disabled={busy}
              onClick={() => rsvpMutation.mutate({ id: event.id, status: null })}
              data-testid={`button-rsvp-cancel-detail-${event.id}`}
            >
              {t("rsvpCancel")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant={mine === "maybe" ? "secondary" : "outline"}
              className="h-11 rounded-full px-4"
              aria-pressed={mine === "maybe"}
              disabled={busy}
              onClick={() => rsvpMutation.mutate({ id: event.id, status: mine === "maybe" ? null : "maybe" })}
              data-testid={`button-rsvp-maybe-${event.id}`}
            >
              <HelpCircle />{mine === "maybe" ? t("rsvpYouMaybe") : t("rsvpMaybe")}
            </Button>
          )
        )}

        {opts.organiser && event.creatorName && (
          <p className="text-xs text-gray-500">
            {t("organizedBy")} {event.creatorName}
          </p>
        )}

        {event.isOwn ? (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3.5 h-11 rounded-full text-destructive hover:bg-red-50 hover:text-destructive"
            onClick={() => {
              if (window.confirm(t("deleteEventConfirm"))) deleteMutation.mutate(event.id);
            }}
            data-testid={`button-delete-event-${event.id}`}
          >
            <Trash2 />{t("delete")}
          </Button>
        ) : (
          <ReportBlockControls
            targetUserId={event.createdByUserId}
            targetType="event"
            targetId={event.id}
            variant="buttons"
          />
        )}
      </div>
    );
  };

  const eventCard = (event: EventItem, isPast: boolean) => {
    const open = openId === event.id;
    const mine = event.rsvp?.mine ?? null;
    const canRsvp = !isPast && event.status === "approved";
    const attendance = attendanceText(event, isPast);
    const organiser = event.creatorName ? ` · ${fill(t("eventByName"), { name: event.creatorName })}` : "";
    return (
      <article key={event.id} className="card-float p-3.5" data-testid={`event-card-${event.id}`}>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
            aria-expanded={open}
            aria-controls={`event-details-${event.id}`}
            onClick={() => setOpenId(open ? null : event.id)}
            data-testid={`button-event-details-${event.id}`}
          >
            <span
              className="flex h-[72px] w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-[18px] bg-gray-50"
              title={formatDate(event.eventDate)}
            >
              <span className="text-[11px] font-semibold uppercase leading-none text-gray-600">{weekdayShort(event.eventDate)}</span>
              <span className="font-display text-2xl font-bold leading-none text-gray-900">{new Date(event.eventDate).getDate()}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <span className="flex items-start gap-1">
                <span className="line-clamp-2 min-w-0 flex-1 font-display text-base font-semibold leading-tight text-gray-900">{event.title}</span>
                <ChevronDown
                  className={`mt-0.5 h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
              <span className="truncate text-[13px] leading-tight text-gray-600">
                {formatTime(event.eventDate)} · {event.location}
              </span>
              <span className="text-xs font-medium leading-snug text-gray-600">
                {attendance}
                {attendance && " · "}
                {event.visibility === "private" ? (
                  <span className="font-semibold text-purple-700">{t("eventConnectionsOnly")}{organiser}</span>
                ) : (
                  <>{t("eventOpenToAll")}{organiser}</>
                )}
                {mine === "maybe" && ` · ${t("rsvpYouMaybe")}`}
              </span>
              {event.status !== "approved" && <span className="flex pt-0.5">{statusTag(event)}</span>}
            </span>
          </button>
          {canRsvp && rsvpPill(event)}
        </div>
        {open && (
          <div className="mt-3.5 border-t border-gray-100 pt-3.5">
            {eventDetails(event, isPast, { whenWhere: true, organiser: false })}
          </div>
        )}
      </article>
    );
  };

  const heroCard = (event: EventItem) => {
    const open = openId === event.id;
    const attendance = attendanceText(event, false);
    return (
      <article className="hero-card flex flex-col gap-4" data-testid={`event-card-${event.id}`}>
        <svg
          aria-hidden="true"
          width="220"
          height="220"
          viewBox="0 0 220 220"
          fill="none"
          className="pointer-events-none absolute -right-[70px] -top-[70px] text-pink-500"
        >
          <circle cx="110" cy="110" r="50" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1.5" />
          <circle cx="110" cy="110" r="80" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1.5" />
          <circle cx="110" cy="110" r="108" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1.5" />
        </svg>
        <span className="relative inline-flex h-7 items-center self-start rounded-full bg-pink-500 px-3 text-xs font-semibold text-white">
          {t("eventYourNext")}
        </span>
        <div className="relative flex flex-col gap-2.5">
          <h2 className="font-display text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-gray-900">{event.title}</h2>
          <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formatLongDay(event.eventDate)} · {formatTime(event.eventDate)}</span>
          </p>
          <p className="flex items-start gap-2 text-sm font-medium text-gray-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{event.location}</span>
          </p>
        </div>
        <div className="relative flex items-center justify-between gap-3">
          <span className="min-w-0 text-[13px] font-medium text-gray-700">{attendance}</span>
          {rsvpPill(event, true)}
        </div>
        <button
          type="button"
          className="relative -my-2 inline-flex min-h-11 items-center gap-1 self-start text-[13px] font-semibold text-pink-700"
          aria-expanded={open}
          aria-controls={`event-details-${event.id}`}
          onClick={() => setOpenId(open ? null : event.id)}
          data-testid={`button-event-details-${event.id}`}
        >
          {open ? t("eventDetailsHide") : t("eventDetailsShow")}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {open && (
          <div className="relative border-t border-pink-200 pt-4">
            {eventDetails(event, false, { whenWhere: false, organiser: true })}
          </div>
        )}
      </article>
    );
  };

  const emptyState = (Icon: LucideIcon, title: string, hint: string, action?: ReactNode) => (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
        <Icon className="h-7 w-7 text-pink-500" aria-hidden="true" />
      </div>
      <h2 className="font-display text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-1.5 max-w-xs text-sm text-gray-600">{hint}</p>
      {action}
    </div>
  );

  const canSubmit =
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.eventDate &&
    form.location.trim().length > 0;

  const filters: { value: EventFilter; label: string }[] = [
    { value: "upcoming", label: t("eventsFilterUpcoming") },
    { value: "mine", label: t("eventsFilterMine") },
    { value: "past", label: t("eventsFilterPast") },
  ];

  const visibilityOption = (value: "public" | "private", Icon: LucideIcon, label: string, hint: string) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 transition-colors ${
        form.visibility === value ? "bg-pink-50 ring-2 ring-inset ring-pink-500" : "bg-gray-50"
      }`}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Icon className="h-4 w-4" aria-hidden="true" />{label}
        </span>
        <span className="mt-0.5 block text-xs text-gray-600">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <AppHeader
        title={t("events")}
        left="none"
        right={
          <button
            type="button"
            className="glass-btn inline-flex h-12 shrink-0 items-center gap-2 rounded-full pl-3.5 pr-4 text-sm font-semibold text-gray-900"
            onClick={() => setCreateOpen(true)}
            data-testid="button-create-event"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
            {t("createEvent")}
          </button>
        }
      />

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setProposalMatchId(null); }}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createEvent")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("eventTitle")} *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("eventTitlePlaceholder")}
                data-testid="input-event-title"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("eventDescription")} *</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("eventDescriptionPlaceholder")}
                data-testid="input-event-description"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("eventDate")} *</Label>
              <Input
                type="datetime-local"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                data-testid="input-event-date"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("eventPlaceSearch")}</Label>
              <GooglePlacesAutocomplete
                onPlaceSelect={(place) =>
                  setForm({
                    ...form,
                    location: place.name ? `${place.name}, ${place.description}` : place.description,
                    latitude: String(place.lat),
                    longitude: String(place.lng),
                  })
                }
                placeholder={t("searchPlaceholder")}
                className="w-full"
              />
              {form.latitude && form.longitude && (
                <span className="tag-violet">
                  <MapPin className="h-3 w-3" aria-hidden="true" />{t("eventPlacePinned")}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("eventLocation")} *</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={t("eventLocationPlaceholder")}
                data-testid="input-event-location"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("eventLink")}</Label>
              <Input
                type="url"
                inputMode="url"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder={t("eventLinkPlaceholder")}
                data-testid="input-event-link"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("eventVisibility")}</Label>
              <RadioGroup
                value={form.visibility}
                onValueChange={(v) => setForm({ ...form, visibility: v as "public" | "private" })}
                className="gap-2"
              >
                {visibilityOption("public", Globe, t("publicEvent"), t("publicEventHint"))}
                {visibilityOption("private", Lock, t("privateEvent"), t("privateEventHint"))}
              </RadioGroup>
            </div>
            <p className="text-xs text-gray-600">{eventSettings?.autoApprove ? t("eventGoesLiveHint") : t("eventCreatedDesc")}</p>
            <Button
              size="lg"
              className="w-full"
              disabled={!canSubmit || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="button-submit-event"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" />{t("sending")}
                </>
              ) : (
                t("createEvent")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <main className="space-y-[18px] px-5 pt-1">
        <div
          role="group"
          aria-label={t("eventsFilterLabel")}
          className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-0.5"
        >
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              className={`chip h-10 px-4 text-sm ${filter === f.value ? "chip-on" : ""}`}
              onClick={() => setFilter(f.value)}
              data-testid={`filter-events-${f.value}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[100px] rounded-3xl skeleton-shimmer" />
            ))}
          </div>
        ) : filter === "upcoming" ? (
          upcoming.length === 0 ? (
            emptyState(
              CalendarDays,
              t("noEventsYet"),
              t("eventsIntro"),
              <Button className="mt-5" onClick={() => setCreateOpen(true)}>
                <Plus />{t("createEvent")}
              </Button>,
            )
          ) : (
            <>
              {nextMine && heroCard(nextMine)}
              {upcomingList.length > 0 && (
                <section className="space-y-2.5">
                  {nextMine && <h2 className="section-label">{t("upcomingEvents")}</h2>}
                  {upcomingList.map((e) => eventCard(e, false))}
                </section>
              )}
            </>
          )
        ) : filter === "mine" ? (
          mineUpcoming.length + minePast.length === 0 ? (
            emptyState(CalendarCheck, t("eventsMineEmptyTitle"), t("eventsMineEmptyHint"))
          ) : (
            <>
              {mineUpcoming.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="section-label">{t("upcomingEvents")}</h2>
                  {mineUpcoming.map((e) => eventCard(e, false))}
                </section>
              )}
              {minePast.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="section-label">{t("pastEvents")}</h2>
                  {minePast.map((e) => eventCard(e, true))}
                </section>
              )}
            </>
          )
        ) : past.length === 0 ? (
          emptyState(History, t("eventsPastEmptyTitle"), t("eventsPastEmptyHint"))
        ) : (
          <section className="space-y-2.5">
            {past.map((e) => eventCard(e, true))}
          </section>
        )}
      </main>
    </div>
  );
}
