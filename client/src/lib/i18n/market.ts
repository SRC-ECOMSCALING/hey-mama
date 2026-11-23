// Redesign (Nov 2026) strings for the "market" area. Keep `en` and `it` in sync:
// `it` is typed from `en`, so a missing key is a compile error.
export const en = {
  // Marketplace: header, search, switches
  marketSell: "Sell",
  marketSearchPlaceholder: "Search strollers, clothes…",
  marketCityAria: "Area: {city}. Change",
  marketListingType: "Listing type",
  marketCategories: "Categories",
  marketScopeForSale: "For sale",
  marketScopeMine: "My listings",
  marketScopeMyServices: "My services",
  marketScopeMyRequests: "My requests",
  // Marketplace: first-time preferences
  marketWhereAreYou: "Where are you?",
  marketStart: "Get started",
  // Marketplace: cards and detail sheet
  marketWriteSeller: "Message the seller",
  marketSaveAria: "Save listing",
  marketUnsaveAria: "Remove from saved",
  marketSellerProfile: "Seller profile",
  marketPhotoN: "Photo {n}",
  marketPrevPhoto: "Previous photo",
  marketNextPhoto: "Next photo",
  // Marketplace: empty states
  marketNoProductsHint: "Publish your first listing: a photo and a price are enough.",
  marketNoServicesHint: "Offer babysitting, tutoring or another skill to the moms near you.",
  // Add product / add service
  marketPublishListing: "Publish listing",
  marketPricePlaceholder: "e.g. 12.50",
  marketRatePlaceholder: "e.g. 15.00",
  marketRemovePhoto: "Remove photo",
  marketPhotoUploaded: "Photo uploaded",
};

export const it: typeof en = {
  // Mercatino: intestazione, ricerca, selettori
  marketSell: "Vendi",
  marketSearchPlaceholder: "Cerca passeggini, vestiti…",
  marketCityAria: "Zona: {city}. Cambia",
  marketListingType: "Tipo di annuncio",
  marketCategories: "Categorie",
  marketScopeForSale: "In vendita",
  marketScopeMine: "I miei annunci",
  marketScopeMyServices: "Miei servizi",
  marketScopeMyRequests: "Mie richieste",
  // Mercatino: preferenze al primo accesso
  marketWhereAreYou: "Dove ti trovi?",
  marketStart: "Inizia",
  // Mercatino: schede e dettaglio
  marketWriteSeller: "Scrivi alla venditrice",
  marketSaveAria: "Salva annuncio",
  marketUnsaveAria: "Togli dai salvati",
  marketSellerProfile: "Profilo della venditrice",
  marketPhotoN: "Foto {n}",
  marketPrevPhoto: "Foto precedente",
  marketNextPhoto: "Foto successiva",
  // Mercatino: stati vuoti
  marketNoProductsHint: "Pubblica il tuo primo annuncio: bastano una foto e un prezzo.",
  marketNoServicesHint: "Offri babysitting, ripetizioni o un'altra tua competenza alle mamme vicine.",
  // Aggiungi prodotto / servizio
  marketPublishListing: "Pubblica annuncio",
  marketPricePlaceholder: "es. 12,50",
  marketRatePlaceholder: "es. 15,00",
  marketRemovePhoto: "Rimuovi foto",
  marketPhotoUploaded: "Foto caricata",
};
