import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft, CalendarDays, Plus, MapPin, ExternalLink, Trash2,
  Clock, Globe, Lock, Loader2,
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
import Navigation from "@/components/navigation";

interface EventItem {
  id: string;
  createdByUserId: string;
  title: string;
  description: string;
  eventDate: string;
  location: string;
  link: string | null;
  visibility: "public" | "private";
  status: "pending" | "approved" | "rejected";
  isOwn: boolean;
  creatorName: string;
  creatorPhotoUrl: string | null;
}

export default function Events() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    eventDate: "",
    location: "",
    link: "",
    visibility: "public" as "public" | "private",
  });

  const { data: events = [], isLoading } = useQuery<EventItem[]>({
    queryKey: ["/api/events"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/events", {
        title: form.title.trim(),
        description: form.description.trim(),
        eventDate: new Date(form.eventDate).toISOString(),
        location: form.location.trim(),
        link: form.link.trim() || null,
        visibility: form.visibility,
      });
      return res.json();
    },
    onSuccess: (event: EventItem) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setCreateOpen(false);
      setForm({ title: "", description: "", eventDate: "", location: "", link: "", visibility: "public" });
      toast({
        title: t("eventCreatedTitle"),
        description: event.status === "approved" ? t("eventCreatedAdminDesc") : t("eventCreatedDesc"),
      });
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
  });

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.eventDate) >= now);
  const past = events.filter((e) => new Date(e.eventDate) < now);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(language === "it" ? "it-IT" : "en-GB", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
  };

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

  const EventCard = ({ event }: { event: EventItem }) => (
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
            </div>
          </div>
          {event.isOwn && (
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
          )}
        </div>

        <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{event.description}</p>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {visibilityBadge(event)}
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

        {event.creatorName && (
          <p className="text-xs text-gray-400 mt-3">
            {t("organizedBy")} {event.creatorName}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <header className="bg-white/85 backdrop-blur-xl shadow-sm sticky top-0 z-40">
        <div className="flex items-center p-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{t("events")}</h1>
            <p className="text-xs text-gray-500">{t("eventsIntro")}</p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button
                size="icon"
                className="rounded-full text-white shadow-md"
                style={{ background: "linear-gradient(135deg, var(--primary-pink), var(--accent-coral))" }}
                data-testid="button-create-event"
              >
                <Plus className="h-5 w-5" />
              </Button>
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
                <p className="text-xs text-gray-500">{t("eventCreatedDesc")}</p>
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
        </div>
      </header>

      {/* Content */}
      <div className="p-4 space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
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
                  {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {t("pastEvents")}
                </h2>
                <div className="space-y-3 opacity-70">
                  {past.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Navigation />
    </div>
  );
}
