import { Mail } from "lucide-react";
import { Link } from "wouter";
import AppHeader from "@/components/app-header";
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
      { q: "Come mi connetto con un'altra mamma?", a: "Da Esplora, tocca una mamma e poi \"Chiedi di conoscervi\": puoi allegare un messaggio. Lei riceve la richiesta e, quando la accetta, potete scrivervi nella sezione Chat. Ogni richiesta e risposta è gratuita." },
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
      { q: "How do I connect with another mom?", a: "In Explore, tap a mom and then \"Ask to connect\": you can attach a note. She receives the request and, once she accepts, you can talk in Chat. Every request and reply is free." },
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
    <div className="min-h-screen bg-gray-50 pb-10">
      <AppHeader title={c.title} right={null} />

      <main className="mx-auto max-w-2xl space-y-5 px-5">
        <p className="px-1 text-[15px] leading-relaxed text-gray-700">{c.intro}</p>

        <section className="hero-card flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-pink-700" aria-hidden="true">
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight text-gray-900">{c.contactLabel}</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-1 inline-flex min-h-8 items-center break-all font-display text-[17px] font-semibold text-pink-700"
              data-testid="link-support-email"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </section>

        <section className="space-y-2.5" aria-labelledby="support-faq">
          <h2 id="support-faq" className="section-label font-sans tracking-normal">{c.faqTitle}</h2>
          <div className="card-float px-4">
            {c.faq.map((item, i) => (
              <div key={i} className="border-b border-gray-100 py-4 last:border-0">
                <h3 className="font-sans text-[15px] font-semibold leading-snug tracking-normal text-gray-900">{item.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
          <Link href="/terms" className="inline-flex min-h-11 items-center font-semibold text-pink-700">{t("termsOfUse")}</Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center font-semibold text-pink-700">{t("privacyPolicy")}</Link>
        </p>
      </main>
    </div>
  );
}
