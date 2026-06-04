import { Location } from "@shared/schema";

interface GooglePlace {
  place_id: string;
  name: string;
  types: string[];
  vicinity?: string;
  formatted_address?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    open_now: boolean;
  };
}

interface GooglePlacesResponse {
  results: GooglePlace[];
  status: string;
  next_page_token?: string;
}

export class GooglePlacesService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor() {
    this.apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY!;
    if (!this.apiKey) {
      throw new Error('VITE_GOOGLE_MAPS_API_KEY environment variable is required');
    }
  }

  async searchNearbyPlaces(
    lat: number,
    lng: number,
    radius: number = 5000, // 5km default
    type: string = 'park'
  ): Promise<Location[]> {
    try {
      // Construct the Google Places Nearby Search URL
      const url = new URL(`${this.baseUrl}/nearbysearch/json`);
      url.searchParams.append('location', `${lat},${lng}`);
      url.searchParams.append('radius', radius.toString());
      url.searchParams.append('type', type);
      url.searchParams.append('key', this.apiKey);

      console.log(`Searching for ${type} near ${lat},${lng} within ${radius}m`);
      const response = await fetch(url.toString());
      const data: GooglePlacesResponse = await response.json();

      if (data.status !== 'OK') {
        console.error('Google Places API error:', data.status);
        if (data.status === 'ZERO_RESULTS') {
          console.log('No results found for the search parameters');
        }
        return [];
      }

      console.log(`Found ${data.results.length} results from Google Places API`);
      
      // Filter and convert results
      const locations = data.results
        .map(place => {
          console.log(`Processing place: ${place.name}, types: ${place.types.join(', ')}`);
          return this.convertGooglePlaceToLocation(place, lat, lng, type);
        })
        .filter(location => location !== null); // Filter out null results
      
      console.log(`Converted to ${locations.length} valid locations`);
      return locations;
    } catch (error) {
      console.error('Error fetching from Google Places API:', error);
      return [];
    }
  }

  async searchParks(
    lat: number,
    lng: number,
    radius: number = 5000
  ): Promise<Location[]> {
    // Search for parks with multiple approaches to get comprehensive results
    console.log(`Searching for parks near ${lat},${lng}`);
    
    // Try different search approaches
    const searches = [
      this.searchNearbyPlaces(lat, lng, radius, 'park'),
      this.searchByKeyword(lat, lng, radius, 'children park'),
      this.searchByKeyword(lat, lng, radius, 'playground'),
      this.searchByKeyword(lat, lng, radius, 'public park')
    ];
    
    const results = await Promise.all(searches);
    
    // Flatten and deduplicate
    const allParks = new Map<string, Location>();
    results.forEach(parkList => {
      parkList.forEach(park => {
        if (!allParks.has(park.googlePlaceId || park.id)) {
          allParks.set(park.googlePlaceId || park.id, park);
        }
      });
    });
    
    const finalResults = Array.from(allParks.values())
      .sort((a, b) => ((a as any).distance || 0) - ((b as any).distance || 0))
      .slice(0, 15); // Get more results to ensure we don't miss parks
    
    console.log(`Found ${finalResults.length} unique parks`);
    return finalResults;
  }
  
  async searchByKeyword(
    lat: number,
    lng: number,
    radius: number,
    keyword: string
  ): Promise<Location[]> {
    try {
      const url = new URL(`${this.baseUrl}/nearbysearch/json`);
      url.searchParams.append('location', `${lat},${lng}`);
      url.searchParams.append('radius', radius.toString());
      url.searchParams.append('keyword', keyword);
      url.searchParams.append('key', this.apiKey);

      console.log(`Searching for keyword '${keyword}' near ${lat},${lng}`);
      const response = await fetch(url.toString());
      const data: GooglePlacesResponse = await response.json();

      if (data.status !== 'OK') {
        if (data.status !== 'ZERO_RESULTS') {
          console.error(`Google Places API error for keyword '${keyword}':`, data.status);
        }
        return [];
      }

      return data.results
        .map(place => this.convertGooglePlaceToLocation(place, lat, lng, 'park'))
        .filter(location => location !== null);
    } catch (error) {
      console.error(`Error searching for keyword '${keyword}':`, error);
      return [];
    }
  }

  async searchMultipleTypes(
    lat: number,
    lng: number,
    radius: number = 5000
  ): Promise<Location[]> {
    // Prioritize parks but include other family-friendly places
    const types = [
      'park', 
      'amusement_park', 
      'cafe', 
      'library',
      'zoo',
      'aquarium'
    ];
    const allPlaces: Location[] = [];

    // Search for multiple types in parallel
    const promises = types.map(type => 
      this.searchNearbyPlaces(lat, lng, radius, type)
    );

    const results = await Promise.all(promises);
    
    // Flatten and deduplicate results
    const seenPlaceIds = new Set<string>();
    results.forEach(places => {
      places.forEach(place => {
        if (place && !seenPlaceIds.has(place.googlePlaceId || place.id)) {
          seenPlaceIds.add(place.googlePlaceId || place.id);
          allPlaces.push(place);
        }
      });
    });

    // Sort by distance and limit to reasonable number
    return allPlaces
      .sort((a, b) => ((a as any).distance || 0) - ((b as any).distance || 0))
      .slice(0, 10);
  }

  private convertGooglePlaceToLocation(place: GooglePlace, searchLat: number, searchLng: number, searchType?: string): Location | null {
    const distance = this.calculateDistance(
      searchLat,
      searchLng,
      place.geometry.location.lat,
      place.geometry.location.lng
    );

    // Determine category based on Google place types - be strict about categorization
    let category: string | null = null;
    
    // Check what type of place this actually is
    if (place.types.includes('park')) {
      category = 'Park';
    } else if (place.types.includes('amusement_park')) {
      category = 'Playground';
    } else if (place.types.includes('cafe') || place.types.includes('restaurant') || place.types.includes('food')) {
      category = 'Cafe';
    } else if (place.types.includes('library')) {
      category = 'Library';
    } else if (place.types.includes('aquarium')) {
      category = 'Water Park';
    } else if (place.types.includes('zoo')) {
      category = 'Activity Center';
    }
    
    // If we're searching for parks specifically, only return actual parks
    if (searchType === 'park' && category !== 'Park') {
      // Check if this might be a park-related place despite not having 'park' type
      const isParkRelated = place.name.toLowerCase().includes('park') || 
                           place.name.toLowerCase().includes('playground') ||
                           place.types.includes('establishment') && 
                           (place.name.toLowerCase().includes('green') || 
                            place.name.toLowerCase().includes('garden'));
      
      if (!isParkRelated) {
        console.log(`Filtering out non-park: ${place.name} (types: ${place.types.join(', ')})`)
        return null; // Don't include non-parks in park search results
      } else {
        category = 'Park'; // Treat park-related places as parks
      }
    }
    
    // If we still don't have a category, try to infer from name or default appropriately
    if (!category) {
      if (place.name.toLowerCase().includes('park')) {
        category = 'Park';
      } else if (searchType === 'park') {
        return null; // If searching for parks and we can't identify it as one, exclude it
      } else {
        category = 'Activity Center'; // Generic category for other searches
      }
    }

    // Generate amenities based on place types
    const amenities: string[] = [];
    if (place.types.includes('park')) amenities.push('Walking paths', 'Green spaces');
    if (place.types.includes('amusement_park')) amenities.push('Playground', 'Rides');
    if (place.types.includes('cafe') || place.types.includes('restaurant')) amenities.push('Food & Drinks', 'Seating');
    if (place.types.includes('library')) amenities.push('Books', 'Reading areas');
    if (place.types.includes('zoo')) amenities.push('Animals', 'Educational');
    if (place.types.includes('aquarium')) amenities.push('Marine life', 'Interactive exhibits');
    if (place.rating && place.rating > 4) amenities.push('Highly rated');

    // Default image based on category
    const defaultImages = {
      'Park': 'https://images.unsplash.com/photo-1544737151144-6e4b998a4b60?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
      'Playground': 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
      'Cafe': 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
      'Library': 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
      'Water Park': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
      'Activity Center': 'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600'
    };

    return {
      id: `google-${place.place_id}`,
      name: place.name,
      category,
      address: place.formatted_address || place.vicinity || 'Address not available',
      province: this.extractProvince(place.formatted_address || place.vicinity || ''),
      description: `${place.name} - A ${category.toLowerCase()} ${place.rating ? `with ${place.rating}/5 stars` : 'in your area'}. ${place.user_ratings_total ? `Based on ${place.user_ratings_total} reviews.` : ''}`,
      imageUrl: defaultImages[category as keyof typeof defaultImages] || defaultImages['Park'],
      rating: Math.round(place.rating || 4),
      amenities: amenities.length > 0 ? amenities : ['Family-friendly'],
      ageGroups: ['0-2', '3-5'], // Default age groups for family places
      coordinates: `${place.geometry.location.lat},${place.geometry.location.lng}`,
      openingHours: place.opening_hours?.open_now !== undefined 
        ? (place.opening_hours.open_now ? 'Open now' : 'Closed now')
        : 'Hours not available',
      googlePlaceId: place.place_id,
      isGooglePlace: true,
      createdAt: new Date(),
      ...({
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal
        reviewCount: place.user_ratings_total || 0,
        averageRating: place.rating || 4,
      } as any)
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private extractProvince(address: string): string {
    // Simple province extraction logic - can be enhanced
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim();
    }
    return 'Unknown';
  }
}