import { storage } from "./storage";

// Import public parks for a city from OpenStreetMap via the Overpass API.
// OSM data is ODbL-licensed: bulk import is allowed with attribution
// ("© OpenStreetMap contributors"), unlike Google Places data.

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export interface OsmImportResult {
  city: string;
  totalFound: number;
  imported: number;
  skippedExisting: number;
  skippedUnnamed: number;
  skippedNoCoords: number;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function queryOverpass(query: string): Promise<OverpassResponse> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "HeyMama-App/1.0 (locations import)",
        },
        body: query,
      });
      if (!response.ok) {
        lastError = new Error(`Overpass ${endpoint} responded ${response.status}`);
        continue;
      }
      const data = await response.json();
      if (!Array.isArray(data.elements)) {
        lastError = new Error(`Overpass ${endpoint} returned no elements array`);
        continue;
      }
      return data as OverpassResponse;
    } catch (err: any) {
      lastError = err;
    }
  }
  throw lastError || new Error("All Overpass endpoints failed");
}

export async function importOsmParks(city: string): Promise<OsmImportResult> {
  // admin_level=8 is the Italian "comune" boundary
  const query = `[out:json][timeout:60];
area["name"="${city}"]["boundary"="administrative"]["admin_level"="8"]->.a;
(
  node["leisure"="park"](area.a);
  way["leisure"="park"](area.a);
  relation["leisure"="park"](area.a);
);
out center tags;`;

  const data = await queryOverpass(query);

  const existing = await storage.getAllLocations();
  const existingOsmIds = new Set(existing.map((l) => l.googlePlaceId).filter(Boolean));
  const existingParkNames = new Set(
    existing
      .filter((l) => l.category === "Parco")
      .map((l) => l.name.trim().toLowerCase()),
  );

  const result: OsmImportResult = {
    city,
    totalFound: data.elements.length,
    imported: 0,
    skippedExisting: 0,
    skippedUnnamed: 0,
    skippedNoCoords: 0,
  };

  for (const el of data.elements) {
    const name = el.tags?.name?.trim();
    if (!name) {
      result.skippedUnnamed++;
      continue;
    }

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) {
      result.skippedNoCoords++;
      continue;
    }

    const osmId = `osm:${el.type}/${el.id}`;
    if (existingOsmIds.has(osmId) || existingParkNames.has(name.toLowerCase())) {
      result.skippedExisting++;
      continue;
    }

    const street = el.tags?.["addr:street"];
    const houseNumber = el.tags?.["addr:housenumber"];
    const address = street
      ? `${street}${houseNumber ? " " + houseNumber : ""}, ${city}`
      : city;

    await storage.createLocation({
      name,
      category: "Parco",
      address,
      province: city,
      description:
        el.tags?.description ||
        `Parco pubblico a ${city}. Dati © OpenStreetMap contributors.`,
      imageUrl: "https://via.placeholder.com/300x200?text=Parco",
      amenities: [],
      ageGroups: ["Tutte le età"],
      coordinates: `${lat},${lng}`,
      openingHours: el.tags?.opening_hours || "Sempre aperto",
      googleMapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
      googlePlaceId: osmId, // reused as a generic external id for dedupe
      isGooglePlace: false,
      approved: true,
    });

    existingOsmIds.add(osmId);
    existingParkNames.add(name.toLowerCase());
    result.imported++;
  }

  return result;
}
