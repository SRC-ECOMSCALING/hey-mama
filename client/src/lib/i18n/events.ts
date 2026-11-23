// Redesign (Nov 2026) strings for the "events" area. Keep `en` and `it` in sync:
// `it` is typed from `en`, so a missing key is a compile error.
export const en = {
  // Events page
  eventsFilterLabel: "Filter events",
  eventsFilterUpcoming: "Upcoming",
  eventsFilterMine: "Mine",
  eventsFilterPast: "Past",
  eventYourNext: "Your next event",
  rsvpJoin: "Join",
  rsvpImIn: "I'll be there",
  eventOpenToAll: "open to everyone",
  eventConnectionsOnly: "Only for your connections",
  eventByName: "by {name}",
  eventDetailsShow: "Details",
  eventDetailsHide: "Hide details",
  eventsMineEmptyTitle: "Nothing here yet",
  eventsMineEmptyHint: "Events you organise and the ones you join will show up here.",
  eventsPastEmptyTitle: "No past events",
  eventsPastEmptyHint: "Events that have already taken place will stay here.",
  // Notifications page
  notifGroupToday: "Today",
  notifGroupThisWeek: "This week",
  notifGroupEarlier: "Earlier",
  notifUnread: "Unread",
  markAsReadShort: "Mark as read",
};

export const it: typeof en = {
  // Pagina Eventi
  eventsFilterLabel: "Filtra gli eventi",
  eventsFilterUpcoming: "In programma",
  eventsFilterMine: "I miei",
  eventsFilterPast: "Passati",
  eventYourNext: "Il tuo prossimo evento",
  rsvpJoin: "Partecipo",
  rsvpImIn: "Ci sarò",
  eventOpenToAll: "aperto a tutte",
  eventConnectionsOnly: "Solo per le tue connessioni",
  eventByName: "da {name}",
  eventDetailsShow: "Dettagli",
  eventDetailsHide: "Nascondi dettagli",
  eventsMineEmptyTitle: "Ancora niente qui",
  eventsMineEmptyHint: "Qui trovi gli eventi che organizzi e quelli a cui partecipi.",
  eventsPastEmptyTitle: "Nessun evento passato",
  eventsPastEmptyHint: "Gli eventi già conclusi restano qui.",
  // Pagina Notifiche
  notifGroupToday: "Oggi",
  notifGroupThisWeek: "Questa settimana",
  notifGroupEarlier: "Prima",
  notifUnread: "Non letta",
  markAsReadShort: "Segna come lette",
};
