import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  CalendarDays, Plus, MapPin, ExternalLink, Trash2,
  Clock, Globe, Lock, Loader2, Check, HelpCircle, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { fill } from "@/lib/format";
import AppHeader from "@/components/app-header";
import Fab from "@/components/fab";
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
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
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

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(language === "it" ? "it-IT" : "en-GB", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
  };

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

  const statusBadge = (event: EventItem) => {
    if (event.status === "pending") {
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">{t("statusPending")}</Badge>;
    }
    if (event.status === "rejected") {
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">{t("statusRejected")}</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">{t("statusApproved")}</Badge>;
  };

  const visibilityBadge = (event: EventItem) => (
    event.visibility === "private" ? (
      <Badge variant="outline" className="border-purple-200 text-purple-600 gap-1">
        <Lock className="h-3 w-3" />{t("privateEvent")}
      </Badge>
    ) : (
      <Badge variant="outline" className="border-blue-200 text-blue-600 gap-1">
        <Globe className="h-3 w-3" />{t("publicEvent")}
      </Badge>
    )
  );

  const canSubmit =
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.eventDate &&
    form.location.trim().length > 0;

  const EventCard = ({ event, isPast }: { event: EventItem; isPast: boolean }) => {
    const mine = event.rsvp?.mine ?? null;
    const going = event.rsvp?.going ?? 0;
    const maybe = event.rsvp?.maybe ?? 0;
    const attendees = event.rsvp?.attendees ?? [];
    const busy = rsvpMutation.isPending && rsvpMutation.variables?.id === event.id;
    return (
      <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden" data-testid={`event-card-${event.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{formatDate(event.eventDate)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{event.location}</span>
                {event.latitude && event.longitude && (
                  <button
                    type="button"
                    className="text-xs text-pink-600 shrink-0 underline"
                    onClick={() => setLocation("/")}
                    data-testid={`button-event-on-map-${event.id}`}
                  >
                    {t("eventPlacePinned")}
                  </button>
                )}
              </div>
            </div>
            {event.isOwn ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-red-500 shrink-0 -mt-1 -mr-1"
                onClick={() => {
                  if (window.confirm(t("deleteEventConfirm"))) deleteMutation.mutate(event.id);
                }}
                data-testid={`button-delete-event-${event.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <ReportBlockControls
                targetUserId={event.createdByUserId}
                targetType="event"
                targetId={event.id}
                variant="icons"
                className="-mt-1 -mr-2"
              />
            )}
          </div>

          <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{event.description}</p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {visibilityBadge(event)}
            {event.creatorIsProfessional && (
              <Badge variant="outline" className="border-amber-200 text-amber-700 gap-1">
                <Briefcase className="h-3 w-3" />{t("commercialEvent")}
              </Badge>
            )}
            {(event.isOwn || event.status !== "approved") && statusBadge(event)}
            {event.link && (
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: "var(--primary-pink)" }}
              >
                <ExternalLink className="h-3.5 w-3.5" />{t("openLink")}
              </a>
            )}
          </div>

          {/* Who else is coming */}
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="flex items-center gap-2 min-w-0">
              {attendees.length > 0 && (
                <div className="flex -space-x-2 shrink-0">
                  {attendees.slice(0, 5).map((a) => (
                    a.photoUrl ? (
                      <img key={a.userId} src={a.photoUrl} alt={a.firstName} title={a.firstName}
                        className={`w-7 h-7 rounded-full border-2 border-white object-cover ${a.status === "maybe" ? "opacity-60" : ""}`} loading="lazy" />
                    ) : (
                      <div key={a.userId} title={a.firstName}
                        className="w-7 h-7 rounded-full border-2 border-white bg-pink-100 text-pink-600 text-[10px] font-semibold flex items-center justify-center">
                        {a.firstName?.[0] ?? "?"}
                      </div>
                    )
                  ))}
                </div>
              )}
              <span className="text-xs text-gray-500 truncate">
                {going > 0 ? fill(t("rsvpGoingCount"), { count: going }) : t("rsvpNobodyYet")}
                {maybe > 0 ? ` · ${fill(t("rsvpMaybeCount"), { count: maybe })}` : ""}
              </span>
            </div>
          </div>

          {!isPast && event.status === "approved" && (
            <div className="flex gap-2 mt-3">
              {mine === "going" ? (
                <>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 gap-1 py-1.5 px-3">
                    <Check className="h-3.5 w-3.5" />{t("rsvpYouGoing")}
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-gray-500" disabled={busy}
                    onClick={() => rsvpMutation.mutate({ id: event.id, status: null })} data-testid={`button-rsvp-cancel-${event.id}`}>
                    {t("rsvpCancel")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="flex-1 rounded-full text-white"
                    style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
                    disabled={busy}
                    onClick={() => rsvpMutation.mutate({ id: event.id, status: "going" })}
                    data-testid={`button-rsvp-going-${event.id}`}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Check className="h-4 w-4 mr-1" />{t("rsvpGoing")}</>)}
                  </Button>
                  <Button
                    size="sm"
                    variant={mine === "maybe" ? "secondary" : "outline"}
                    className="flex-1 rounded-full"
                    disabled={busy}
                    onClick={() => rsvpMutation.mutate({ id: event.id, status: mine === "maybe" ? null : "maybe" })}
                    data-testid={`button-rsvp-maybe-${event.id}`}
                  >
                    <HelpCircle className="h-4 w-4 mr-1" />{mine === "maybe" ? t("rsvpYouMaybe") : t("rsvpMaybe")}
                  </Button>
                </>
              )}
            </div>
          )}

          {event.creatorName && (
            <p className="text-xs text-gray-400 mt-3">
              {t("organizedBy")} {event.creatorName}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <AppHeader />

      {/* Title */}
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold text-gray-900">{t("events")}</h1>
        <p className="text-xs text-gray-500">{t("eventsIntro")}</p>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setProposalMatchId(null); }}>
        <DialogTrigger asChild>
          <Fab data-testid="button-create-event" aria-label={t("createEvent")}>
            <Plus className="h-6 w-6" />
          </Fab>
        </DialogTrigger>
        <DialogContent className="max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createEvent")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("eventTitle")} *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("eventTitlePlaceholder")}
                data-testid="input-event-title"
              />
            </div>
            <div>
              <Label>{t("eventDescription")} *</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("eventDescriptionPlaceholder")}
                data-testid="input-event-description"
              />
            </div>
            <div>
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
                <div className="text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1 inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{t("eventPlacePinned")}
                </div>
              )}
            </div>
            <div>
              <Label>{t("eventLocation")} *</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={t("eventLocationPlaceholder")}
                data-testid="input-event-location"
              />
            </div>
            <div>
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
            <div>
              <Label>{t("eventVisibility")}</Label>
              <RadioGroup
                value={form.visibility}
                onValueChange={(v) => setForm({ ...form, visibility: v as "public" | "private" })}
                className="mt-2 space-y-2"
              >
                <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer has-[input:checked]:border-pink-300 has-[input:checked]:bg-pink-50/50">
                  <RadioGroupItem value="public" className="mt-0.5" />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-sm text-gray-900">
                      <Globe className="h-4 w-4" />{t("publicEvent")}
                    </span>
                    <span className="text-xs text-gray-500">{t("publicEventHint")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer has-[input:checked]:border-pink-300 has-[input:checked]:bg-pink-50/50">
                  <RadioGroupItem value="private" className="mt-0.5" />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-sm text-gray-900">
                      <Lock className="h-4 w-4" />{t("privateEvent")}
                    </span>
                    <span className="text-xs text-gray-500">{t("privateEventHint")}</span>
                  </span>
                </label>
              </RadioGroup>
            </div>
            <p className="text-xs text-gray-500">{eventSettings?.autoApprove ? t("eventGoesLiveHint") : t("eventCreatedDesc")}</p>
            <Button
              className="w-full text-white"
              style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
              disabled={!canSubmit || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="button-submit-event"
            >
              {createMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />{t("sending")}
                </span>
              ) : (
                t("createEvent")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div className="p-4 space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)" }}
            >
              <CalendarDays className="h-8 w-8" style={{ color: "var(--primary-pink)" }} />
            </div>
            <h3 className="font-semibold text-gray-900">{t("noEventsYet")}</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">{t("eventsIntro")}</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {t("upcomingEvents")}
                </h2>
                <div className="space-y-3">
                  {upcoming.map((e) => <EventCard key={e.id} event={e} isPast={false} />)}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {t("pastEvents")}
                </h2>
                <div className="space-y-3 opacity-70">
                  {past.map((e) => <EventCard key={e.id} event={e} isPast />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      {user?.accountType === "professional" && null}
    </div>
  );
}
