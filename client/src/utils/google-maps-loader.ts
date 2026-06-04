// Google Maps API loader utility
let isLoaded = false;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

export function loadGoogleMapsAPI(): Promise<void> {
  if (isLoaded) {
    return Promise.resolve();
  }

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google && window.google.maps) {
      isLoaded = true;
      isLoading = false;
      resolve();
      return;
    }

    // Get API key from environment
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key not found in environment');
      reject(new Error('Google Maps API key not found'));
      return;
    }

    console.log('Loading Google Maps API with Places library...');

    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('Google Maps API loaded successfully');
      isLoaded = true;
      isLoading = false;
      resolve();
    };

    script.onerror = (error) => {
      console.error('Failed to load Google Maps script:', error);
      isLoading = false;
      reject(new Error('Failed to load Google Maps API script'));
    };

    // Add to head
    document.head.appendChild(script);
  });

  return loadPromise;
}

declare global {
  interface Window {
    google: any;
  }
}