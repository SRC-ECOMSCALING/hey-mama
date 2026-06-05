import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Bilingual privacy policy content. Kept inline (not in translations.ts) because
// it's long-form legal copy that only this page renders.
// NOTE: replace the contact email / legal entity placeholders with your real
// company details before publishing.
const CONTACT_EMAIL = "privacy@heymama.app";
const LAST_UPDATED = "2026-06-05";

type Section = { heading: string; body: string[] };
type Content = { title: string; intro: string; updatedLabel: string; sections: Section[] };

const CONTENT: Record<"it" | "en", Content> = {
  it: {
    title: "Informativa sulla Privacy",
    updatedLabel: "Ultimo aggiornamento",
    intro:
      "La tua privacy è importante per noi. Questa informativa spiega quali dati personali raccoglie HeyMama!, come li utilizziamo, con chi li condividiamo e quali diritti hai. Usando l'app accetti le pratiche descritte di seguito.",
    sections: [
      {
        heading: "1. Titolare del trattamento",
        body: [
          "Il titolare del trattamento dei dati è HeyMama!. Per qualsiasi domanda relativa ai tuoi dati personali puoi scriverci all'indirizzo indicato nella sezione Contatti.",
        ],
      },
      {
        heading: "2. Dati che raccogliamo",
        body: [
          "Dati dell'account: indirizzo email e password (conservata in forma cifrata).",
          "Dati del profilo: nome e cognome, età, sesso, biografia, hobby, foto e (se forniti) un link Vinted.",
          "Dati relativi ai figli: numero di figli, età ed eventualmente il sesso, inseriti volontariamente per facilitare le connessioni tra mamme.",
          "Posizione: la città indicata e, per le funzioni di ricerca luoghi e match nelle vicinanze, coordinate geografiche approssimative.",
          "Contenuti generati: messaggi, recensioni, annunci del marketplace e servizi pubblicati.",
          "Dati di pagamento: gestiti dal nostro fornitore Stripe; non memorizziamo i dati completi della tua carta sui nostri server.",
          "Dati tecnici e di utilizzo: informazioni sul dispositivo, log e dati di analisi sull'uso dell'app.",
        ],
      },
      {
        heading: "3. Come utilizziamo i dati",
        body: [
          "Per creare e gestire il tuo account e il tuo profilo.",
          "Per offrirti le funzioni principali: scoperta di altre mamme, match, messaggistica, luoghi family-friendly e marketplace.",
          "Per elaborare abbonamenti e pagamenti.",
          "Per inviarti comunicazioni di servizio (es. verifica email) tramite il nostro fornitore di email.",
          "Per garantire sicurezza, prevenire abusi e migliorare l'app.",
          "Le basi giuridiche del trattamento sono l'esecuzione del contratto (fornitura del servizio), il consenso (es. dati facoltativi e posizione) e il legittimo interesse (sicurezza e miglioramento del servizio).",
        ],
      },
      {
        heading: "4. Condivisione con terze parti",
        body: [
          "Non vendiamo i tuoi dati personali. Li condividiamo solo con fornitori che ci aiutano a far funzionare l'app:",
          "Stripe — elaborazione dei pagamenti e degli abbonamenti.",
          "Google Maps Platform — visualizzazione mappe e ricerca di luoghi.",
          "Brevo — invio delle email transazionali.",
          "Google Analytics — statistiche aggregate sull'utilizzo.",
          "Fornitori di hosting e archiviazione cloud — per ospitare l'applicazione, il database e le foto caricate.",
          "Questi fornitori trattano i dati per nostro conto secondo i rispettivi termini e informative.",
        ],
      },
      {
        heading: "5. Conservazione dei dati",
        body: [
          "Conserviamo i tuoi dati personali finché il tuo account è attivo o per il tempo necessario a fornirti il servizio. Alla cancellazione dell'account rimuoviamo o anonimizziamo i tuoi dati, salvo obblighi legali di conservazione.",
        ],
      },
      {
        heading: "6. Sicurezza",
        body: [
          "Adottiamo misure tecniche e organizzative adeguate per proteggere i tuoi dati, tra cui la cifratura delle password e connessioni protette. Nessun sistema è però sicuro al 100%: ti invitiamo a usare una password robusta e a non condividerla.",
        ],
      },
      {
        heading: "7. I tuoi diritti",
        body: [
          "In base al GDPR e alla normativa applicabile hai diritto di: accedere ai tuoi dati, rettificarli, cancellarli, limitarne o opporti al trattamento, e richiederne la portabilità.",
          "Puoi anche revocare il consenso in qualsiasi momento e proporre reclamo all'autorità di controllo competente (in Italia, il Garante per la protezione dei dati personali).",
          "Per esercitare i tuoi diritti contattaci all'indirizzo indicato nella sezione Contatti.",
        ],
      },
      {
        heading: "8. Minori",
        body: [
          "HeyMama! è destinata a utenti adulti (18+). Non raccogliamo consapevolmente dati di minori come utenti. I dati relativi ai figli sono forniti dal genitore esclusivamente per finalità di profilo e connessione.",
        ],
      },
      {
        heading: "9. Trasferimenti internazionali",
        body: [
          "Alcuni nostri fornitori possono trattare i dati al di fuori dell'Unione Europea. In tali casi adottiamo garanzie adeguate (es. clausole contrattuali standard) per proteggere i tuoi dati.",
        ],
      },
      {
        heading: "10. Cookie e tecnologie simili",
        body: [
          "Utilizziamo tecnologie di archiviazione locale per il funzionamento dell'app (es. mantenere la sessione di accesso) e strumenti di analisi per comprenderne l'utilizzo.",
        ],
      },
      {
        heading: "11. Modifiche a questa informativa",
        body: [
          "Possiamo aggiornare questa informativa di tanto in tanto. In caso di modifiche rilevanti te ne daremo notizia tramite l'app o via email. La data dell'ultimo aggiornamento è indicata in alto.",
        ],
      },
      {
        heading: "12. Contatti",
        body: [
          `Per qualsiasi domanda su questa informativa o sul trattamento dei tuoi dati, scrivici a: ${CONTACT_EMAIL}`,
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updatedLabel: "Last updated",
    intro:
      "Your privacy matters to us. This policy explains what personal data HeyMama! collects, how we use it, who we share it with, and the rights you have. By using the app you accept the practices described below.",
    sections: [
      {
        heading: "1. Data Controller",
        body: [
          "The data controller is HeyMama!. For any question about your personal data, contact us at the address in the Contact section.",
        ],
      },
      {
        heading: "2. Data we collect",
        body: [
          "Account data: email address and password (stored in encrypted form).",
          "Profile data: first and last name, age, sex, bio, hobbies, photos and (if provided) a Vinted link.",
          "Children data: number of children, their ages and optionally their sex, provided voluntarily to help connect with other moms.",
          "Location: the city you provide and, for nearby place search and matching, approximate geographic coordinates.",
          "User-generated content: messages, reviews, marketplace listings and services you post.",
          "Payment data: handled by our provider Stripe; we do not store full card details on our servers.",
          "Technical and usage data: device information, logs and analytics about how you use the app.",
        ],
      },
      {
        heading: "3. How we use your data",
        body: [
          "To create and manage your account and profile.",
          "To provide core features: discovering other moms, matching, messaging, family-friendly places and the marketplace.",
          "To process subscriptions and payments.",
          "To send service communications (e.g. email verification) through our email provider.",
          "To ensure security, prevent abuse and improve the app.",
          "The legal bases are performance of the contract (providing the service), consent (e.g. optional data and location) and legitimate interest (security and service improvement).",
        ],
      },
      {
        heading: "4. Sharing with third parties",
        body: [
          "We do not sell your personal data. We share it only with providers that help us run the app:",
          "Stripe — payment and subscription processing.",
          "Google Maps Platform — maps display and place search.",
          "Brevo — sending transactional emails.",
          "Google Analytics — aggregated usage statistics.",
          "Hosting and cloud storage providers — to host the application, database and uploaded photos.",
          "These providers process data on our behalf under their respective terms and policies.",
        ],
      },
      {
        heading: "5. Data retention",
        body: [
          "We keep your personal data while your account is active or as needed to provide the service. When you delete your account we remove or anonymize your data, unless we must retain it for legal reasons.",
        ],
      },
      {
        heading: "6. Security",
        body: [
          "We use appropriate technical and organizational measures to protect your data, including password encryption and secure connections. No system is 100% secure, so please use a strong password and keep it private.",
        ],
      },
      {
        heading: "7. Your rights",
        body: [
          "Under the GDPR and applicable law you have the right to: access your data, rectify it, erase it, restrict or object to processing, and request portability.",
          "You may also withdraw consent at any time and lodge a complaint with the competent supervisory authority.",
          "To exercise your rights, contact us at the address in the Contact section.",
        ],
      },
      {
        heading: "8. Children",
        body: [
          "HeyMama! is intended for adult users (18+). We do not knowingly collect data from minors as users. Children data is provided by the parent solely for profile and connection purposes.",
        ],
      },
      {
        heading: "9. International transfers",
        body: [
          "Some of our providers may process data outside the European Union. In such cases we apply appropriate safeguards (e.g. standard contractual clauses) to protect your data.",
        ],
      },
      {
        heading: "10. Cookies and similar technologies",
        body: [
          "We use local storage technologies for the app to function (e.g. keeping you logged in) and analytics tools to understand usage.",
        ],
      },
      {
        heading: "11. Changes to this policy",
        body: [
          "We may update this policy from time to time. If we make material changes we will notify you in the app or by email. The last updated date is shown at the top.",
        ],
      },
      {
        heading: "12. Contact",
        body: [
          `For any question about this policy or how we handle your data, write to us at: ${CONTACT_EMAIL}`,
        ],
      },
    ],
  },
};

export default function Privacy() {
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
          <h1 className="text-xl font-bold" data-testid="text-privacy-title">
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
