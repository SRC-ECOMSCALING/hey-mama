import type { TranslationKey } from "@/lib/translations";

// Stored option values (categories, conditions, colours, …) are fixed Italian
// strings that live in the database and in existing listings; only how they
// are displayed follows the user's language. Anything not listed here (brands,
// numeric sizes, legacy free text) is shown as-is.
const LABEL_KEYS: Record<string, TranslationKey> = {
  // Condition (stored as slug)
  "new-with-tags": "condNewWithTags",
  "new-without-tags": "condNewWithoutTags",
  excellent: "condExcellent",
  good: "condGood",
  fair: "condFair",
  damaged: "condDamaged",

  // Product category (stored as "Group > Name")
  "Abbigliamento > Neonati 0-12 mesi": "catClothingNewborn",
  "Abbigliamento > Bambini 1-5 anni": "catClothingKids",
  "Calzature > Primi passi": "catFirstShoes",
  "Calzature > Bambino": "catKidsShoes",
  "Passeggini e Viaggi > Passeggini": "catStrollers",
  "Passeggini e Viaggi > Seggiolini auto": "catCarSeats",
  "Passeggini e Viaggi > Zaini porta bebè": "catBabyCarriers",
  "Alimentazione > Biberon": "catBottles",
  "Alimentazione > Seggioloni": "catHighchairs",
  "Alimentazione > Sterilizzatori": "catSterilizers",
  "Giochi e Libri > Peluche": "catPlush",
  "Giochi e Libri > Giochi educativi": "catEducationalToys",
  "Giochi e Libri > Libri per bambini": "catKidsBooks",
  "Cameretta > Lettini": "catCribs",
  "Cameretta > Fasciatoi": "catChangingTables",
  "Cameretta > Decorazioni": "catNurseryDecor",
  "Cura e Igiene > Pannolini": "catDiapers",
  "Cura e Igiene > Bagnetto": "catBathProducts",

  // Season
  Estivo: "seasonSummer",
  Invernale: "seasonWinter",
  "Tutto l'anno": "seasonAllYear",

  // Colour
  Nero: "colorBlack",
  Bianco: "colorWhite",
  Rosso: "colorRed",
  Blu: "colorBlue",
  Verde: "colorGreen",
  Giallo: "colorYellow",
  Rosa: "colorPink",
  Viola: "colorPurple",
  Marrone: "colorBrown",
  Grigio: "colorGray",
  Beige: "colorBeige",
  Arancione: "colorOrange",
  Multicolore: "colorMulti",

  // Material
  "Cotone 100%": "matCotton100",
  "Cotone organico": "matOrganicCotton",
  Bambù: "matBamboo",
  "Lana merino": "matMerino",
  Pile: "matFleece",
  Poliestere: "matPolyester",
  "Misto cotone": "matCottonBlend",
  Jersey: "matJersey",
  Mussola: "matMuslin",
  Spugna: "matTerry",
  "Plastica BPA-free": "matBpaFreePlastic",
  Silicone: "matSilicone",
  "Acciaio inox": "matStainlessSteel",
  Legno: "matWood",
  "Tessuto impermeabile": "matWaterproof",
  "Non specificato": "matUnspecified",

  // Size (numeric ones like "68cm" need no translation)
  Prematuro: "sizePremature",
  "0-1 mese": "size0to1Month",
  "1-3 mesi": "size1to3Months",
  "3-6 mesi": "size3to6Months",
  "6-9 mesi": "size6to9Months",
  "9-12 mesi": "size9to12Months",
  "12-18 mesi": "size12to18Months",
  "18-24 mesi": "size18to24Months",
  "2 anni": "size2Years",
  "3 anni": "size3Years",
  "4 anni": "size4Years",
  "5 anni": "size5Years",
  "Taglia unica": "sizeOneSize",
  Regolabile: "sizeAdjustable",
  "Non applicabile": "sizeNotApplicable",

  // Age groups (services)
  "0-2 anni": "age0to2",
  "3-5 anni": "age3to5",
  "6-12 anni": "age6to12",
  "13+ anni": "age13plus",
  Adulti: "ageAdults",
  "Tutte le età": "ageAllAges",

  // Service type (stored in English)
  Babysitting: "svcBabysitting",
  Tutoring: "svcTutoring",
  Cleaning: "svcCleaning",
  "Pet Care": "svcPetCare",
  "Meal Prep": "svcMealPrep",
  Transportation: "svcTransportation",
  "Elderly Care": "svcElderlyCare",
  "Personal Training": "svcPersonalTraining",
  "Music Lessons": "svcMusicLessons",
  "Language Tutoring": "svcLanguageTutoring",
  Other: "svcOther",
};

type Translate = (key: TranslationKey) => string;

export function optionLabel(t: Translate, value: string | null | undefined): string {
  if (!value) return "";
  const key = LABEL_KEYS[value];
  if (key) return t(key);
  // Shoe sizes are stored as "Scarpe 16" … "Scarpe 30"
  const shoe = value.match(/^Scarpe (\d+)$/);
  if (shoe) return `${t("sizeShoes")} ${shoe[1]}`;
  return value;
}

// Comma-separated multi-values (e.g. the age groups a service covers)
export function optionLabels(t: Translate, values: string | null | undefined): string {
  if (!values) return "";
  return values
    .split(",")
    .map((v) => optionLabel(t, v.trim()))
    .filter(Boolean)
    .join(", ");
}
