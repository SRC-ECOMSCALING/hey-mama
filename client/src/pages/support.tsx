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
      { q: "Come mi connetto con un'altra mamma?", a: "Dalla schermata Scopri, apri il profilo di una mamma e tocca \"Connetti\": potrete iniziare subito a scrivervi nella sezione Messaggi." },
      { q: "Come elimino il mio account?", a: "Vai su Profilo → Impostazioni → Elimina account. La cancellazione rimuove il tuo profilo e tutti i dati collegati." },
      { q: "Come gestisco l'abbonamento?", a: "Puoi gestire o annullare l'abbonamento dalle impostazioni del tuo account App Store (ID Apple → Abbonamenti)." },
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
      { q: "How do I connect with another mom?", a: "On the Discover screen, open a mom's profile and tap \"Connect\": you can start messaging right away in the Messages section." },
      { q: "How do I delete my account?", a: "Go to Profile → Settings → Delete account. Deletion removes your profile and all related data." },
      { q: "How do I manage my subscription?", a: "You can manage or cancel your subscription from your App Store account settings (Apple ID → Subscriptions)." },
    ],
  },
};

export default function Support() {
  const { language } = useLanguage();
  const c = CONTENT[language === "en" ? "en" : "it"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Back"
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
