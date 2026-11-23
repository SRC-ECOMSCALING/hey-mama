import { Mail, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import AppHeader from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

// Public pages required by the app stores (Google Play "Data safety"):
//   /delete-account  how to delete the account and everything linked to it
//   /delete-data     how to delete some data while keeping the account
// Both must be reachable without the app and without logging in.
const SUPPORT_EMAIL = "support@heymama.app";

type Mode = "account" | "data";
type Block = { title: string; items: string[] };
type Content = {
  title: string;
  intro: string;
  stepsTitle: string;
  steps: string[];
  blocks: Block[];
  emailTitle: string;
  emailBody: string;
  emailSubject: string;
  ctaLoggedIn: string;
  ctaLoggedOut: string;
  otherPageLabel: string;
};

const CONTENT: Record<Mode, Record<"it" | "en", Content>> = {
  account: {
    it: {
      title: "Eliminare l'account HeyMama!",
      intro:
        "Puoi eliminare il tuo account HeyMama! in qualsiasi momento, dall'app o dal sito. L'eliminazione è immediata e non si può annullare.",
      stepsTitle: "Come fare",
      steps: [
        "Apri l'app HeyMama! oppure accedi su my.heymama.app con la tua email e password.",
        "Vai su Profilo e tocca Impostazioni.",
        "In fondo alla pagina, nella sezione Account, tocca «Elimina account».",
        "Conferma. L'account viene eliminato subito e vieni disconnessa.",
      ],
      blocks: [
        {
          title: "Cosa viene eliminato",
          items: [
            "Il tuo account: email e password.",
            "Il tuo profilo: nome, età, provincia, descrizione, foto, età dei bambini e interessi.",
            "Le tue connessioni, le richieste inviate e ricevute e i messaggi che hai scritto.",
            "I tuoi annunci, servizi e richieste del Mercatino, con le relative conversazioni.",
            "Gli eventi che hai creato e le tue adesioni agli eventi.",
            "Le tue recensioni dei luoghi, le notifiche e le preferenze.",
          ],
        },
        {
          title: "Cosa può restare",
          items: [
            "Le segnalazioni che altre persone hanno fatto sul tuo account, per il tempo necessario a tutelare la community.",
            "I dati che siamo obbligati a conservare per legge, per il periodo previsto.",
            "I luoghi che hai suggerito e che sono stati approvati restano visibili, senza alcun riferimento a te.",
          ],
        },
      ],
      emailTitle: "Non riesci ad accedere?",
      emailBody:
        "Scrivici dall'indirizzo email con cui ti sei registrata e chiedi l'eliminazione dell'account. Lo eliminiamo entro 30 giorni e ti mandiamo conferma.",
      emailSubject: "Richiesta di eliminazione account",
      ctaLoggedIn: "Vai alle impostazioni",
      ctaLoggedOut: "Accedi per eliminare l'account",
      otherPageLabel: "Vuoi eliminare solo alcuni dati?",
    },
    en: {
      title: "Delete your HeyMama! account",
      intro:
        "You can delete your HeyMama! account at any time, from the app or the website. Deletion is immediate and cannot be undone.",
      stepsTitle: "How to do it",
      steps: [
        "Open the HeyMama! app, or log in at my.heymama.app with your email and password.",
        "Go to Profile and tap Settings.",
        "At the bottom of the page, in the Account section, tap “Delete account”.",
        "Confirm. The account is deleted straight away and you are logged out.",
      ],
      blocks: [
        {
          title: "What is deleted",
          items: [
            "Your account: email and password.",
            "Your profile: name, age, province, description, photos, kids' ages and interests.",
            "Your connections, the requests you sent and received, and the messages you wrote.",
            "Your Marketplace listings, services and requests, with their conversations.",
            "The events you created and your event RSVPs.",
            "Your reviews of places, your notifications and your preferences.",
          ],
        },
        {
          title: "What may be kept",
          items: [
            "Reports other people filed about your account, for as long as needed to protect the community.",
            "Data we are legally required to keep, for the period the law sets.",
            "Places you suggested that were approved stay visible, with no reference to you.",
          ],
        },
      ],
      emailTitle: "Can't log in?",
      emailBody:
        "Write to us from the email address you registered with and ask for your account to be deleted. We delete it within 30 days and send you a confirmation.",
      emailSubject: "Account deletion request",
      ctaLoggedIn: "Go to settings",
      ctaLoggedOut: "Log in to delete your account",
      otherPageLabel: "Want to delete only some data?",
    },
  },
  data: {
    it: {
      title: "Eliminare i tuoi dati senza eliminare l'account",
      intro:
        "Puoi rimuovere singoli dati da HeyMama! mantenendo l'account. Quasi tutto si elimina direttamente dall'app; per il resto basta scriverci.",
      stepsTitle: "Dall'app o dal sito",
      steps: [
        "Foto, descrizione, età dei bambini e interessi: Profilo → Modifica. Togli o cambia quello che vuoi e salva.",
        "Annunci e richieste del Mercatino: Mercatino → I miei annunci (o Le mie richieste), apri l'annuncio ed eliminalo.",
        "Eventi che hai creato: Eventi → I miei, apri l'evento e tocca Elimina. Per ritirare un'adesione, tocca di nuovo «Ci sarò».",
        "Stato di attività: Profilo → Impostazioni → disattiva «Mostra quando sono attiva».",
      ],
      blocks: [
        {
          title: "Dati che eliminiamo su richiesta",
          items: [
            "Messaggi che hai inviato in una chat.",
            "Recensioni dei luoghi che hai scritto.",
            "Servizi che hai pubblicato nel Mercatino.",
            "Una connessione con un'altra mamma.",
            "Qualsiasi altro dato personale legato al tuo account.",
          ],
        },
      ],
      emailTitle: "Come chiederlo",
      emailBody:
        "Scrivici dall'indirizzo email del tuo account indicando quali dati vuoi eliminare. Li rimuoviamo entro 30 giorni e ti mandiamo conferma. Il tuo account resta attivo.",
      emailSubject: "Richiesta di eliminazione dati",
      ctaLoggedIn: "Vai al tuo profilo",
      ctaLoggedOut: "Accedi a HeyMama!",
      otherPageLabel: "Vuoi eliminare tutto l'account?",
    },
    en: {
      title: "Delete your data without deleting your account",
      intro:
        "You can remove individual pieces of data from HeyMama! and keep your account. Most of it can be deleted directly in the app; for the rest, just write to us.",
      stepsTitle: "From the app or the website",
      steps: [
        "Photos, description, kids' ages and interests: Profile → Edit. Remove or change what you like and save.",
        "Marketplace listings and requests: Marketplace → My listings (or My requests), open the listing and delete it.",
        "Events you created: Events → Mine, open the event and tap Delete. To withdraw an RSVP, tap “I'm in” again.",
        "Activity status: Profile → Settings → turn off “Show when I'm active”.",
      ],
      blocks: [
        {
          title: "Data we delete on request",
          items: [
            "Messages you sent in a chat.",
            "Reviews of places you wrote.",
            "Services you published in the Marketplace.",
            "A connection with another mom.",
            "Any other personal data linked to your account.",
          ],
        },
      ],
      emailTitle: "How to ask",
      emailBody:
        "Write to us from your account's email address and tell us which data you want deleted. We remove it within 30 days and send you a confirmation. Your account stays active.",
      emailSubject: "Data deletion request",
      ctaLoggedIn: "Go to your profile",
      ctaLoggedOut: "Log in to HeyMama!",
      otherPageLabel: "Want to delete the whole account?",
    },
  },
};

export default function DataDeletion({ mode }: { mode: Mode }) {
  const { language, t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const c = CONTENT[mode][language === "en" ? "en" : "it"];
  const ctaHref = !isAuthenticated ? "/login" : mode === "account" ? "/settings" : "/profile";

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <AppHeader right={null} backTo="/" />
      <main className="space-y-5 px-5">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-gray-900" data-testid="text-deletion-title">
            {c.title}
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-gray-600">{c.intro}</p>
        </div>

        <section className="space-y-2.5" aria-labelledby="deletion-steps">
          <h2 id="deletion-steps" className="section-label">{c.stepsTitle}</h2>
          <ol className="card-float px-4">
            {c.steps.map((step, i) => (
              <li key={i} className="flex gap-3 border-b border-gray-100 py-4 last:border-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-50 font-display text-[13px] font-semibold text-pink-700">
                  {i + 1}
                </span>
                <span className="text-[15px] leading-relaxed text-gray-800">{step}</span>
              </li>
            ))}
          </ol>
          <Button asChild size="lg" className="w-full" data-testid="button-deletion-cta">
            <Link href={ctaHref}>{isAuthenticated ? c.ctaLoggedIn : c.ctaLoggedOut}</Link>
          </Button>
        </section>

        {c.blocks.map((block) => (
          <section key={block.title} className="space-y-2.5">
            <h2 className="section-label">{block.title}</h2>
            <ul className="card-float space-y-2.5 p-4">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-800">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="hero-card flex items-start gap-3.5 rounded-3xl" aria-labelledby="deletion-email">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white" aria-hidden="true">
            <Mail className="h-5 w-5 text-pink-700" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <h2 id="deletion-email" className="font-sans text-[15px] font-semibold leading-tight tracking-normal text-gray-900">{c.emailTitle}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-800">{c.emailBody}</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(c.emailSubject)}`}
              className="mt-1.5 inline-flex min-h-11 items-center break-all font-display text-[17px] font-semibold text-pink-700"
              data-testid="link-deletion-email"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </section>

        <p className="flex items-start gap-2.5 text-[13px] leading-snug text-gray-600">
          <ShieldCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-purple-600" />
          <span>
            <Link href={mode === "account" ? "/delete-data" : "/delete-account"} className="font-semibold text-pink-700 underline">
              {c.otherPageLabel}
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="font-semibold text-pink-700 underline">
              {t("privacyPolicy")}
            </Link>
          </span>
        </p>
      </main>
    </div>
  );
}
