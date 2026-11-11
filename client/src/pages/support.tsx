import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Public support page (App Store requires a functional Support URL).
// NOTE: replace the contact email with your real support address.
const SUPPORT_EMAIL = "support@heymama.app";

type QA = { q: string; a: string };
type Content = { title: string; intro: string; contactLabel: string; faqTitle: string; faq: QA[] };

const CONTENT: Record<"it" | "en", Content> = {
  it: {
    title: "Supporto",
    intro:
      "Hai bisogno di aiuto con HeyMama!? Siamo qui per te. Scrivici e ti risponderemo al più presto.",
    contactLabel: "Contattaci via email",
    faqTitle: "Domande frequenti",
    faq: [
      { q: "Come funziona HeyMama!?", a: "HeyMama! è una community per mamme: puoi conoscere altre mamme vicine, organizzare playdate, scoprire luoghi a misura di bambino e comprare o vendere articoli per l'infanzia." },
      { q: "Come mi connetto con un'altra mamma?", a: "Dalla mappa, tocca una mamma e poi \"Connetti\": puoi allegare un messaggio. Lei riceve la richiesta e, quando la accetta, potete scrivervi nella sezione Messaggi. Ogni richiesta e risposta è gratuita." },
      { q: "Come elimino il mio account?", a: "Vai su Profilo → Impostazioni → Elimina account. La cancellazione rimuove il tuo profilo e tutti i dati collegati." },
      { q: "HeyMama! è gratuita?", a: "Sì: connetterti, scrivere, partecipare agli eventi e usare il marketplace non costa nulla." },
      { q: "Quali notifiche ricevo?", a: "Solo richieste di connessione, richieste accettate, nuovi messaggi ed eventi approvati. Puoi attivarle o disattivarle da Impostazioni; mai pubblicità." },
      { q: "Come segnalo o blocco qualcuno?", a: "Su ogni profilo, chat, annuncio ed evento trovi le icone Segnala e Blocca. Il team rivede ogni segnalazione; un utente bloccato non vede più i tuoi contenuti." },
    ],
  },
  en: {
    title: "Support",
    intro:
      "Need help with HeyMama!? We're here for you. Reach out and we'll get back to you as soon as possible.",
    contactLabel: "Contact us by email",
    faqTitle: "Frequently asked questions",
    faq: [
      { q: "How does HeyMama! work?", a: "HeyMama! is a community for moms: meet other moms nearby, plan playdates, discover family-friendly places, and buy or sell kids' items." },
      { q: "How do I connect with another mom?", a: "On the map, tap a mom and then \"Connect\": you can attach a note. She receives the request and, once she accepts, you can chat in Messages. Every request and reply is free." },
      { q: "How do I delete my account?", a: "Go to Profile → Settings → Delete account. Deletion removes your profile and all related data." },
      { q: "Is HeyMama! free?", a: "Yes: connecting, messaging, joining events and using the marketplace cost nothing." },
      { q: "Which notifications will I get?", a: "Only connection requests, accepted requests, new messages and approved events. Turn them on or off in Settings; never marketing." },
      { q: "How do I report or block someone?", a: "Every profile, chat, listing and event has Report and Block icons. The team reviews every report; a blocked user no longer sees your content." },
    ],
  },
};

export default function Support() {
  const { language, t } = useLanguage();
  const c = CONTENT[language === "en" ? "en" : "it"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label={t("back")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold" data-testid="text-support-title">{c.title}</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <p className="text-sm text-gray-700 leading-relaxed">{c.intro}</p>

        <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 mb-1">{c.contactLabel}</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-pink-600 hover:text-pink-700 font-medium"
            data-testid="link-support-email"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">{c.faqTitle}</h2>
          <div className="space-y-4">
            {c.faq.map((item, i) => (
              <div key={i} className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
                <p className="text-sm font-semibold text-gray-900 mb-1">{item.q}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm pt-2">
          <a href="/terms" className="text-muted-foreground underline hover:text-gray-700">Termini · Terms</a>
          <a href="/privacy" className="text-muted-foreground underline hover:text-gray-700">Privacy</a>
        </div>
      </div>
    </div>
  );
}
