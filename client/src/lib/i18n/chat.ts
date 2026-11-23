// Redesign (Nov 2026) strings for the "chat" area. Keep `en` and `it` in sync:
// `it` is typed from `en`, so a missing key is a compile error.
export const en = {
  // Chat tab: requests
  chatRequestsCount: "Requests · {count}",
  chatSeeAll: "See all",
  chatShowLess: "Show less",
  chatWantsToMeet: "{name} would like to meet you",
  chatKidsAges: "kids' ages: {ages}",
  chatNotNow: "Not now",
  chatAcceptReply: "Accept and reply",
  chatAwaitingReply: "Waiting for a reply",
  // Chat tab: connected moms
  chatYourMoms: "Your moms",
  chatFind: "Find",
  chatFindMoms: "Find moms nearby",
  chatWriteTo: "Message {name}",
  chatConnectedOn: "You connected on {date}",
  // Chat tab: conversations
  chatConversations: "Conversations",
  chatFilterAll: "All",
  chatFilterMoms: "Moms",
  chatYou: "You",
  chatUnread: "{count} unread",
  chatEmptyMomsHint: "Tap one of your moms above to write to her.",
  // Conversation
  chatMoreActions: "More actions",
  chatMessageFor: "Message for {name}",
  chatMarketEmptyHint: "Write to {name} about “{title}”",
  chatThisPerson: "this person",
  chatThisListing: "this listing",
};

export const it: typeof en = {
  chatRequestsCount: "Richieste · {count}",
  chatSeeAll: "Vedi tutte",
  chatShowLess: "Mostra meno",
  chatWantsToMeet: "{name} vuole conoscerti",
  chatKidsAges: "età bimbi: {ages}",
  chatNotNow: "Non ora",
  chatAcceptReply: "Accetta e rispondi",
  chatAwaitingReply: "In attesa di risposta",
  chatYourMoms: "Le tue mamme",
  chatFind: "Trova",
  chatFindMoms: "Trova mamme vicine",
  chatWriteTo: "Scrivi a {name}",
  chatConnectedOn: "Vi siete connesse {date}",
  chatConversations: "Conversazioni",
  chatFilterAll: "Tutte",
  chatFilterMoms: "Mamme",
  chatYou: "Tu",
  chatUnread: "{count} da leggere",
  chatEmptyMomsHint: "Tocca una delle tue mamme qui sopra per scriverle.",
  chatMoreActions: "Altre azioni",
  chatMessageFor: "Messaggio per {name}",
  chatMarketEmptyHint: "Scrivi a {name} per «{title}»",
  chatThisPerson: "questa persona",
  chatThisListing: "questo annuncio",
};
