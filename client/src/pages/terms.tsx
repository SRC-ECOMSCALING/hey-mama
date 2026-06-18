import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Bilingual Terms of Use. Kept inline (not in translations.ts) because it's
// long-form legal copy that only this page renders.
// NOTE: replace the contact email / legal entity placeholders with your real
// company details before publishing.
const CONTACT_EMAIL = "support@heymama.app";
const LAST_UPDATED = "2026-06-10";

type Section = { heading: string; body: string[] };
type Content = { title: string; intro: string; updatedLabel: string; sections: Section[] };

const CONTENT: Record<"it" | "en", Content> = {
  it: {
    title: "Termini di Utilizzo",
    updatedLabel: "Ultimo aggiornamento",
    intro:
      "Benvenuta su HeyMama!. Questi Termini di Utilizzo regolano l'accesso e l'uso dell'app. Creando un account o utilizzando l'app accetti integralmente i presenti Termini e la nostra Informativa sulla Privacy. Se non li accetti, ti preghiamo di non usare l'app.",
    sections: [
      {
        heading: "1. Accettazione dei Termini",
        body: [
          "Utilizzando HeyMama! confermi di aver letto, compreso e accettato questi Termini e l'Informativa sulla Privacy. Possiamo aggiornare i Termini nel tempo: l'uso continuato dell'app dopo eventuali modifiche costituisce accettazione delle stesse.",
        ],
      },
      {
        heading: "2. Requisiti per l'uso",
        body: [
          "Per usare HeyMama! devi avere almeno 18 anni e la capacità legale di stipulare un contratto vincolante.",
          "Ti impegni a fornire informazioni veritiere, accurate e aggiornate durante la registrazione e a mantenerle tali.",
        ],
      },
      {
        heading: "3. Account",
        body: [
          "Sei responsabile della riservatezza delle tue credenziali e di tutte le attività svolte tramite il tuo account.",
          "Avvisaci tempestivamente in caso di uso non autorizzato del tuo account.",
          "Puoi eliminare il tuo account in qualsiasi momento; alcune informazioni potrebbero essere conservate ove richiesto dalla legge.",
        ],
      },
      {
        heading: "4. Regole di condotta",
        body: [
          "HeyMama! è una community di mamme: ti impegni a comportarti con rispetto.",
          "È vietato pubblicare contenuti illegali, offensivi, diffamatori, molesti, ingannevoli o che violino i diritti altrui.",
          "È vietato impersonare altre persone, raccogliere dati di altri utenti senza consenso o usare l'app per finalità commerciali non autorizzate o spam.",
          "Ci riserviamo il diritto di rimuovere contenuti e sospendere o chiudere account che violino questi Termini.",
        ],
      },
      {
        heading: "5. Contenuti degli utenti",
        body: [
          "Resti titolare dei contenuti che pubblichi (foto, testi, annunci). Concedi a HeyMama! una licenza non esclusiva e gratuita per ospitarli e mostrarli all'interno dell'app al fine di fornirti il servizio.",
          "Sei l'unico responsabile dei contenuti che pubblichi e garantisci di avere il diritto di condividerli.",
        ],
      },
      {
        heading: "6. Marketplace e servizi tra utenti",
        body: [
          "Il marketplace e la sezione servizi permettono agli utenti di proporre, vendere, acquistare o richiedere oggetti e servizi. HeyMama! è solo una piattaforma di intermediazione e non è parte degli accordi tra utenti.",
          "Le transazioni, i pagamenti, la consegna e la qualità di oggetti e servizi sono responsabilità esclusiva degli utenti coinvolti. Ti invitiamo a usare prudenza e buon senso negli scambi.",
        ],
      },
      {
        heading: "7. Abbonamenti e pagamenti",
        body: [
          "Alcune funzionalità possono richiedere un abbonamento a pagamento. I pagamenti sono gestiti dal nostro fornitore Stripe.",
          "I prezzi, la durata e le modalità di rinnovo vengono comunicati al momento dell'acquisto. Eventuali rimborsi sono regolati dalla normativa applicabile e dalle condizioni indicate al momento dell'acquisto.",
        ],
      },
      {
        heading: "8. Proprietà intellettuale",
        body: [
          "Il nome, il logo, il software e i contenuti di HeyMama! (esclusi i contenuti degli utenti) sono protetti e di proprietà di HeyMama! o dei suoi licenzianti. Non puoi copiarli o utilizzarli senza autorizzazione.",
        ],
      },
      {
        heading: "9. Esclusione di garanzie",
        body: [
          "L'app è fornita \"così com'è\". Pur impegnandoci a offrire un servizio affidabile, non garantiamo che sia sempre disponibile, privo di errori o adatto a ogni scopo specifico.",
        ],
      },
      {
        heading: "10. Limitazione di responsabilità",
        body: [
          "Nei limiti consentiti dalla legge, HeyMama! non è responsabile per danni indiretti o incidentali derivanti dall'uso dell'app, né per le interazioni, gli accordi o le transazioni tra utenti.",
        ],
      },
      {
        heading: "11. Sospensione e chiusura",
        body: [
          "Possiamo sospendere o chiudere l'accesso all'app in caso di violazione di questi Termini o di uso improprio del servizio.",
        ],
      },
      {
        heading: "12. Legge applicabile",
        body: [
          "Questi Termini sono regolati dalla legge italiana. Per eventuali controversie sarà competente il foro del luogo di residenza del consumatore, ove previsto dalla normativa applicabile.",
        ],
      },
      {
        heading: "13. Modifiche ai Termini",
        body: [
          "Possiamo aggiornare questi Termini di tanto in tanto. In caso di modifiche rilevanti te ne daremo notizia tramite l'app. La data dell'ultimo aggiornamento è indicata in alto.",
        ],
      },
      {
        heading: "14. Contatti",
        body: [
          `Per domande sui presenti Termini scrivici a: ${CONTACT_EMAIL}`,
        ],
      },
    ],
  },
  en: {
    title: "Terms of Use",
    updatedLabel: "Last updated",
    intro:
      "Welcome to HeyMama!. These Terms of Use govern access to and use of the app. By creating an account or using the app you fully accept these Terms and our Privacy Policy. If you do not accept them, please do not use the app.",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        body: [
          "By using HeyMama! you confirm that you have read, understood and accepted these Terms and the Privacy Policy. We may update the Terms over time: continued use of the app after changes constitutes acceptance.",
        ],
      },
      {
        heading: "2. Eligibility",
        body: [
          "To use HeyMama! you must be at least 18 years old and legally able to enter into a binding contract.",
          "You agree to provide truthful, accurate and up-to-date information during registration and to keep it current.",
        ],
      },
      {
        heading: "3. Account",
        body: [
          "You are responsible for keeping your credentials confidential and for all activity carried out through your account.",
          "Notify us promptly of any unauthorized use of your account.",
          "You may delete your account at any time; some information may be retained where required by law.",
        ],
      },
      {
        heading: "4. Code of conduct",
        body: [
          "HeyMama! is a community of mothers: you agree to behave respectfully.",
          "You may not post illegal, offensive, defamatory, harassing, misleading content or content that infringes others' rights.",
          "You may not impersonate others, collect other users' data without consent, or use the app for unauthorized commercial purposes or spam.",
          "We reserve the right to remove content and suspend or terminate accounts that violate these Terms.",
        ],
      },
      {
        heading: "5. User content",
        body: [
          "You retain ownership of the content you post (photos, text, listings). You grant HeyMama! a non-exclusive, royalty-free license to host and display it within the app to provide the service.",
          "You are solely responsible for the content you post and warrant that you have the right to share it.",
        ],
      },
      {
        heading: "6. Marketplace and peer services",
        body: [
          "The marketplace and services sections let users offer, sell, buy or request items and services. HeyMama! is only an intermediary platform and is not a party to agreements between users.",
          "Transactions, payments, delivery and the quality of items and services are the sole responsibility of the users involved. Please use caution and common sense.",
        ],
      },
      {
        heading: "7. Subscriptions and payments",
        body: [
          "Some features may require a paid subscription. Payments are processed by our provider Stripe.",
          "Prices, duration and renewal terms are disclosed at purchase. Any refunds are governed by applicable law and the conditions shown at purchase.",
        ],
      },
      {
        heading: "8. Intellectual property",
        body: [
          "The HeyMama! name, logo, software and content (excluding user content) are protected and owned by HeyMama! or its licensors. You may not copy or use them without authorization.",
        ],
      },
      {
        heading: "9. Disclaimer of warranties",
        body: [
          "The app is provided \"as is\". While we strive to offer a reliable service, we do not guarantee it will always be available, error-free or fit for any specific purpose.",
        ],
      },
      {
        heading: "10. Limitation of liability",
        body: [
          "To the extent permitted by law, HeyMama! is not liable for indirect or incidental damages arising from use of the app, nor for interactions, agreements or transactions between users.",
        ],
      },
      {
        heading: "11. Suspension and termination",
        body: [
          "We may suspend or terminate access to the app in case of violation of these Terms or misuse of the service.",
        ],
      },
      {
        heading: "12. Governing law",
        body: [
          "These Terms are governed by Italian law. For any disputes, the court of the consumer's place of residence shall have jurisdiction where provided by applicable law.",
        ],
      },
      {
        heading: "13. Changes to the Terms",
        body: [
          "We may update these Terms from time to time. If we make material changes we will notify you in the app. The last updated date is shown at the top.",
        ],
      },
      {
        heading: "14. Contact",
        body: [
          `For questions about these Terms, write to us at: ${CONTACT_EMAIL}`,
        ],
      },
    ],
  },
};

export default function Terms() {
  const { language } = useLanguage();
  const c = CONTENT[language === "en" ? "en" : "it"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white pb-20">
      {/* Header */}
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
          <h1 className="text-xl font-bold" data-testid="text-terms-title">
            {c.title}
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <p className="text-xs text-muted-foreground" data-testid="text-last-updated">
          {c.updatedLabel}: {LAST_UPDATED}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">{c.intro}</p>

        {c.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
