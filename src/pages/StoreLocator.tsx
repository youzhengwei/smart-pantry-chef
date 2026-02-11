import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { NearbyStore } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { highlightKeywords } from '@/lib/utils';
import { 
  MapPin, 
  Search, 
  Loader2,
  ShoppingCart,
  Navigation,
} from 'lucide-react';

interface ProductSearchResult {
  supermarket: string;
  title: string;
  price: string;
  measurement: string;
  link: string;
  hasItem: boolean;
}

interface StoreResult {
  storeName: string;
  storeCode: string;
  url: string;
  hasItem: boolean;
}

import StoreCard from '@/components/StoreCard';
import Filters from '@/components/Filters';
import InAppMap from '@/components/InAppMap';

// Environment variables
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;

const StoreLocator: React.FC = () => {
  const location = useLocation();
  const { toast } = useToast();
  const [results, setResults] = useState<NearbyStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedArea, setSelectedArea] = useState('');
  const [nearbyStores, setNearbyStores] = useState<NearbyStore[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStoreType, setSelectedStoreType] = useState('all');
  const [distanceFilter, setDistanceFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [selectedMapStore, setSelectedMapStore] = useState<NearbyStore | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<{
    lat: number;
    lng: number;
    name?: string;
    address?: string;
    rating?: number;
    isOpen?: boolean;
  } | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  // Product search state
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);
  const [chainsWithItem, setChainsWithItem] = useState<string[]>([]);
  const [nearestByChain, setNearestByChain] = useState<Record<string, NearbyStore | null>>({});
  const [productSearchLoading, setProductSearchLoading] = useState(false);

  // N8N webhook search state
  const [webhookQuery, setWebhookQuery] = useState('');
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookResults, setWebhookResults] = useState<StoreResult[]>([]);

  // Get initial search from navigation state
  const initialSearch = (location.state as { searchItem?: string })?.searchItem || '';

  // Helper function for distance calculation
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (initialSearch && !productSearchLoading && productResults.length === 0) {
      searchProducts(initialSearch);
    }
  }, [initialSearch]);

  const filteredNearbyStores = useMemo(() => {
    return nearbyStores.filter(store => {
      // Block specific non-store results
      if (store.displayName.text === 'Yen Investments Pte. Ltd.' || 
          store.formattedAddress.includes('304 Woodlands Street 31, Singapore 730304')) {
        return false;
      }

      // Distance filter - only apply if userLocation exists
      if (distanceFilter !== 'all' && userLocation) {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, store.location.latitude, store.location.longitude);
        if (distance > parseInt(distanceFilter)) return false;
      }
      // If no user location, distance filter is ignored (show all results)

      // Rating filter
      if (ratingFilter !== 'all') {
        if (!store.rating) return false;
        
        if (ratingFilter === '4.0') {
          if (store.rating < 4.0) return false;
        } else if (ratingFilter === '3.0') {
          if (store.rating < 3.0 || store.rating >= 4.0) return false;
        } else if (ratingFilter === 'below3') {
          if (store.rating >= 3.0) return false;
        }
      }

      return true;
    });
  }, [nearbyStores, distanceFilter, ratingFilter, userLocation]);

  const filteredResults = useMemo(() => {
    return results.filter(store => {
      // Block specific non-store results
      if (store.displayName.text === 'Yen Investments Pte. Ltd.' ||
          store.formattedAddress.includes('304 Woodlands Street 31, Singapore 730304')) {
        return false;
      }

      // Distance filter - only apply if userLocation exists
      if (distanceFilter !== 'all' && userLocation) {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, store.location.latitude, store.location.longitude);
        if (distance > parseInt(distanceFilter)) return false;
      }
      // If no user location, distance filter is ignored (show all results)

      // Rating filter
      if (ratingFilter !== 'all') {
        if (!store.rating) return false;

        if (ratingFilter === '4.0') {
          if (store.rating < 4.0) return false;
        } else if (ratingFilter === '3.0') {
          if (store.rating < 3.0 || store.rating >= 4.0) return false;
        } else if (ratingFilter === 'below3') {
          if (store.rating >= 3.0) return false;
        }
      }

      return true;
    });
  }, [results, distanceFilter, ratingFilter, userLocation]);

  const handleSearch = async () => {
    if (!selectedArea.trim()) {
      toast({
        title: 'Please enter an area',
        description: 'Enter an area name to search for stores.',
        variant: 'destructive',
      });
      return;
    }

    setSearching(true);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        throw new Error('Google Places API key not configured');
      }

      let allStores: NearbyStore[] = [];

      if (selectedStoreType === 'convenience_store') {
        // For convenience stores, do two searches: general convenience stores + specific chains
        const convenienceQuery = `convenience stores in ${selectedArea.trim()}, Singapore`;
        const chainsQuery = `7-eleven cheers in ${selectedArea.trim()}, Singapore`;

        // Search 1: General convenience stores
        const convRequestBody = {
          textQuery: convenienceQuery,
          includedType: "convenience_store",
          maxResultCount: 25,
          locationBias: {
            circle: {
              center: { latitude: 1.3521, longitude: 103.8198 },
              radius: 30000.0
            }
          }
        };

        // Search 2: Specific convenience chains
        const chainsRequestBody = {
          textQuery: chainsQuery,
          maxResultCount: 25,
          locationBias: {
            circle: {
              center: { latitude: 1.3521, longitude: 103.8198 },
              radius: 30000.0
            }
          }
        };

        const [convResponse, chainsResponse] = await Promise.all([
          fetch(`http://localhost:3001/api/places/searchText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours'
            },
            body: JSON.stringify(convRequestBody)
          }),
          fetch(`http://localhost:3001/api/places/searchText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours'
            },
            body: JSON.stringify(chainsRequestBody)
          })
        ]);

        if (!convResponse.ok || !chainsResponse.ok) {
          const convError = !convResponse.ok ? await convResponse.text() : '';
          const chainsError = !chainsResponse.ok ? await chainsResponse.text() : '';
          console.error('API Error Response:', { convError, chainsError });
          throw new Error(`Places API search failed: ${convError || chainsError}`);
        }

        const convResult = await convResponse.json();
        const chainsResult = await chainsResponse.json();

        console.log('Convenience stores result:', convResult);
        console.log('Chains result:', chainsResult);

        // Combine results and remove duplicates
        const convStores = convResult.places || [];
        const chainsStores = chainsResult.places || [];
        
        // Remove duplicates based on location
        const allResults = [...convStores, ...chainsStores];
        const uniqueStores = allResults.filter((store, index, self) => 
          index === self.findIndex(s => 
            s.location.latitude === store.location.latitude && 
            s.location.longitude === store.location.longitude
          )
        );

        allStores = uniqueStores;
      } else {
        // For other store types, use the regular single search
        const url = `http://localhost:3001/api/places/searchText`;
        const requestBody: any = {
          textQuery: selectedStoreType === 'all' 
            ? `supermarkets and convenience stores in ${selectedArea.trim()}, Singapore`
            : `${selectedStoreType.replace('_', ' ')} in ${selectedArea.trim()}, Singapore`,
          maxResultCount: 50,
          locationBias: {
            circle: {
              center: { latitude: 1.3521, longitude: 103.8198 },
              radius: 30000.0
            }
          }
        };

        console.log('Search query:', requestBody.textQuery);

        // Only use includedType for convenience_store, not for supermarket to get more results
        if (selectedStoreType !== 'all' && selectedStoreType !== 'supermarket') {
          requestBody.includedType = selectedStoreType;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours'
          },
          body: JSON.stringify(requestBody)
        });

        console.log('API Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error:', errorText);
          throw new Error(`Places API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('API Response:', result);
        allStores = result.places || [];
      }

      console.log('API returned stores count:', allStores.length);
      console.log('Sample stores:', allStores.slice(0, 3));

      // Filter to only include stores in Hong Kong or Singapore
      const stores = allStores.filter((store: NearbyStore) => {
        const address = store.formattedAddress.toLowerCase();
        const name = store.displayName.text.toLowerCase();

        // Check if address contains HK/SG indicators
        const hasHKSG = address.includes('singapore') || address.includes('hong kong') ||
                       address.includes('hk') || address.includes('sg') ||
                       /singapore/i.test(address) || /hong kong/i.test(address);

        // More generous bounds check for Singapore and Hong Kong
        const inBounds = (
          (store.location.latitude >= 1.0 && store.location.latitude <= 1.6 &&
           store.location.longitude >= 103.4 && store.location.longitude <= 104.2) || // Singapore (expanded)
          (store.location.latitude >= 22.0 && store.location.latitude <= 22.7 &&
           store.location.longitude >= 113.7 && store.location.longitude <= 114.6)   // Hong Kong (expanded)
        );

        // Exclude specific unwanted stores
        const isExcludedStore = name.includes('homekong mart') || name.includes('鄉港旺舖');

        console.log(`Store: ${name}, inBounds: ${inBounds}, hasHKSG: ${hasHKSG}, excluded: ${isExcludedStore}`);

        // Accept if either in bounds OR has HK/SG in address
        return (hasHKSG || inBounds) && !isExcludedStore;
      });

      console.log('Filtered stores count:', stores.length);

      setResults(stores);

      if (stores.length === 0) {
        console.log('No stores after filtering. All stores:', allStores);
        toast({
          title: 'No stores found',
          description: `No stores found in "${selectedArea}". API returned ${allStores.length} results but none matched filters. Check console for details.`,
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const getUserLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Location request timed out. Please check your location permissions.'));
      }, 10000); // 10 second timeout

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          resolve(location);
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error('Geolocation error:', error);
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error('Location access denied. Please enable location permissions in your browser.'));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error('Location information is unavailable.'));
              break;
            case error.TIMEOUT:
              reject(new Error('Location request timed out.'));
              break;
            default:
              reject(new Error('An unknown location error occurred.'));
              break;
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  const handleFindNearbyStores = async () => {
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const location = await getUserLocation();
      
      // Check if location is in Hong Kong or Singapore
      const isInHKSg = (
        (location.lat >= 1.1 && location.lat <= 1.5 && location.lng >= 103.5 && location.lng <= 104.1) || // Singapore
        (location.lat >= 22.1 && location.lat <= 22.6 && location.lng >= 113.8 && location.lng <= 114.5)   // Hong Kong
      );
      
      if (!isInHKSg) {
        throw new Error('Nearby search is only available in Singapore. Please use the area search instead.');
      }
      
      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        throw new Error('Google Places API key not configured. Please check your environment variables.');
      }

      console.log('Searching for nearby stores at:', location);

      const url = 'http://localhost:3001/api/places/searchNearby';
      const requestBody = {
        includedTypes: selectedStoreType === 'all' 
          ? ["supermarket", "convenience_store"]
          : selectedStoreType === 'convenience_store'
          ? ["convenience_store", "grocery_store"] // Keep grocery_store for additional convenience chains
          : [selectedStoreType],
        locationRestriction: {
          circle: {
            center: {
              latitude: location.lat,
              longitude: location.lng
            },
            radius: 8000.0 // Increased from 5000 to 8000 meters
          }
        },
        maxResultCount: 20, // Google Places API Nearby Search limit is 20
        rankPreference: "DISTANCE"
      };

      console.log('Making API request to:', url);
      console.log('Request body:', requestBody);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours,places.priceLevel'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Places API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('API response data:', result);

      // Filter to only include stores in Hong Kong or Singapore
      const filteredStores = (result.places || []).filter((store: NearbyStore) => {
        const address = store.formattedAddress.toLowerCase();
        const name = store.displayName.text.toLowerCase();

        // Check if address contains HK/SG indicators
        const hasHKSG = address.includes('singapore') || address.includes('hong kong') ||
                       address.includes('hk') || address.includes('sg') ||
                       /\bsingapore\b/.test(address) || /\bhong kong\b/.test(address);

        // Additional check: coordinates should be within HK/SG bounds
        const inBounds = (
          (store.location.latitude >= 1.1 && store.location.latitude <= 1.5 &&
           store.location.longitude >= 103.5 && store.location.longitude <= 104.1) || // Singapore
          (store.location.latitude >= 22.1 && store.location.latitude <= 22.6 &&
           store.location.longitude >= 113.8 && store.location.longitude <= 114.5)   // Hong Kong
        );

        // Exclude specific unwanted stores
        const isExcludedStore = name.includes('homekong mart') || name.includes('鄉港旺舖');

        return (hasHKSG || inBounds) && !isExcludedStore;
      });

      setNearbyStores(filteredStores);

      if (!filteredStores || filteredStores.length === 0) {
        setNearbyError('No nearby stores found in Singapore within 8km. Try using the area search instead.');
      }
    } catch (error) {
      console.error('Error finding nearby stores:', error);
      setNearbyError(error instanceof Error ? error.message : 'Failed to find nearby stores');
    } finally {
      setNearbyLoading(false);
    }
  };

  const getEstimatedTravelTime = (distanceKm: number) => {
    // Average walking speed: 5 km/h, driving speed: 30 km/h
    const walkingMinutes = Math.round((distanceKm / 5) * 60);
    const drivingMinutes = Math.round((distanceKm / 30) * 60);

    return {
      walking: walkingMinutes < 60 ? `${walkingMinutes} min walk` : `${Math.round(walkingMinutes/60)}h ${walkingMinutes%60}min walk`,
      driving: drivingMinutes < 60 ? `${drivingMinutes} min drive` : `${Math.round(drivingMinutes/60)}h ${drivingMinutes%60}min drive`
    };
  };

  const openInGoogleMaps = (store: NearbyStore) => {
    // Set the store for modal and show map
    setSelectedMapStore(store);
    setSelectedDestination(null);
    setShowMapModal(true);
  };

  // Chain display names mapping
  const CHAIN_DISPLAY_NAME: Record<string, string> = {
    ntuc: 'NTUC FairPrice',
    'cold-storage': 'Cold Storage',
    'sheng-siong': 'Sheng Siong',
  };

  // Clean search query by removing quantities and units
  const cleanSearchQuery = (query: string): string => {
    // Remove common quantity and unit patterns from the query
    let cleaned = query.trim();
    
    // Remove leading/trailing quantities and units
    cleaned = cleaned.replace(/^\d+(\.\d+)?\s*(kg|kilogram|g|gram|mg|l|liter|ml|pack|packs|pc|pcs|piece|pieces|box|boxes|bottle|bottles|can|cans|oz|lb|lbs)\b/i, '').trim();
    cleaned = cleaned.replace(/\b\d+(\.\d+)?\s*(kg|kilogram|g|gram|mg|l|liter|ml|pack|packs|pc|pcs|piece|pieces|box|boxes|bottle|bottles|can|cans|oz|lb|lbs)$/i, '').trim();
    
    // Remove quantities at the start (e.g., "1 nuts" -> "nuts")
    cleaned = cleaned.replace(/^\d+\s+/, '').trim();
    
    return cleaned || query; // Return original if cleaning removes everything
  };

  // Search for products using the backend
  const searchProducts = async (query: string) => {
    setProductSearchLoading(true);
    
    // Clean the query before searching
    const cleanedQuery = cleanSearchQuery(query);
    console.log('Original query:', query);
    console.log('Cleaned query:', cleanedQuery);
    
    try {
      // Use local scraper endpoint for stricter matching
      const proxyUrl = 'http://localhost:3000/search-products';

      console.log('searchProducts - Fetching from proxy:', proxyUrl);
      console.log('searchProducts - Query:', cleanedQuery);

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: cleanedQuery }),
      });

      console.log('searchProducts - Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || `Product search failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('searchProducts - Response data:', data);
      console.log('searchProducts - Full response object:', JSON.stringify(data, null, 2));
      console.log('searchProducts - data.results type:', typeof data.results);
      console.log('searchProducts - data.results value:', data.results);
      
      // Check if results is the literal expression string (n8n misconfiguration)
      if (typeof data.results === 'string' && data.results.includes('$json')) {
        console.error('ERROR: n8n workflow is returning a literal expression string instead of evaluating it');
        console.error('The "Respond to Webhook" node in n8n is misconfigured');
        throw new Error(
          'N8N Workflow Configuration Error: The "Respond to Webhook" node is not properly evaluating the results expression. ' +
          'In n8n, go to the Respond to Webhook node and ensure the response body mode is set to "Using Expressions" and use: ' +
          '{{ { "results": $json.body.results } }} or similar. Do NOT use quotes around the expression.'
        );
      }
      
      // Validate that results is an array
      if (!Array.isArray(data.results)) {
        console.error('Invalid response format from n8n. Expected results array, got:', typeof data.results);
        console.error('Complete response:', data);
        throw new Error(
          `Invalid response format from n8n. Expected results array, got: ${typeof data.results}. ` +
          `Response: ${JSON.stringify(data)}`
        );
      }
      
      console.log('searchProducts - Results count:', data.results.length);
      data.results.forEach((r: StoreResult, idx: number) => {
        console.log(`  [${idx}] ${r.storeName}: hasItem=${r.hasItem}`);
      });
      
      // Transform StoreResult[] to ProductSearchResult[] for compatibility
      const results: ProductSearchResult[] = data.results.map((store: StoreResult) => ({
        supermarket: store.storeName,
        title: `${store.hasItem ? 'Available' : 'Not available'} at ${store.storeName}`,
        price: store.hasItem ? 'In Stock' : '',
        measurement: '',
        link: store.url,
        hasItem: store.hasItem,
      }));

      console.log('searchProducts - Transformed results:', results);
      setProductResults(results);

      // Extract unique chains that have this item
      const chains = Array.from(new Set(results.map((r: ProductSearchResult) => r.supermarket)));
      setChainsWithItem(chains);

      // If we have user location and chains, find nearest stores for each chain
      if (userLocation && chains.length > 0) {
        await findNearestStoresForChains(chains, userLocation);
      }

      if (results.length === 0) {
        toast({
          title: 'No products found',
          description: `No products found for "${query}". Try a different search term.`,
        });
      }
    } catch (error) {
      console.error('Product search error:', error);
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProductSearchLoading(false);
    }
  };

  // Handle N8N webhook search for store availability
  const handleFindClick = async () => {
    const trimmedQuery = webhookQuery.trim();
    if (!trimmedQuery) {
      setWebhookError('Please enter a product name');
      return;
    }

    // Clean the query to remove quantities and units
    const cleanedQuery = cleanSearchQuery(trimmedQuery);
    console.log('Original query:', trimmedQuery);
    console.log('Cleaned query for search:', cleanedQuery);

    if (cleanedQuery.length < 2) {
      setWebhookError('Please enter at least 2 characters for a reliable search');
      return;
    }

    if (!/[a-zA-Z]/.test(cleanedQuery)) {
      setWebhookError('Please include letters in your search');
      return;
    }

    setWebhookLoading(true);
    setWebhookError(null);
    setWebhookResults([]);

    try {
      // Use local scraper endpoint for stricter matching
      const proxyUrl = 'http://localhost:3000/search-products';
      
      console.log('Fetching from proxy:', proxyUrl);
      console.log('Query:', cleanedQuery);
      
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: cleanedQuery }),
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || `Search failed: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      console.log('Webhook response data:', data);
      console.log('Webhook response full object:', JSON.stringify(data, null, 2));
      console.log('Webhook response data.results type:', typeof data.results);
      console.log('Webhook response data.results:', data.results);
      
      // Check if results is the literal expression string (n8n misconfiguration)
      if (typeof data.results === 'string' && data.results.includes('$json')) {
        console.error('ERROR: n8n workflow is returning a literal expression string instead of evaluating it');
        throw new Error(
          'N8N Configuration Error: The webhook response is returning a literal expression string. ' +
          'In n8n "Respond to Webhook" node, ensure the response body is properly configured to evaluate expressions. ' +
          'Use: {{ { "results": $json.body.results } }} (with curly braces, no extra quotes)'
        );
      }
      
      // Validate that results is an array
      if (!Array.isArray(data.results)) {
        console.error('Invalid response format from n8n. Expected results array, got:', typeof data.results);
        console.error('Complete response:', data);
        throw new Error(
          `Invalid response format. Expected results array, got: ${typeof data.results}. ` +
          `Full response: ${JSON.stringify(data)}`
        );
      }
      
      console.log('Webhook - Results count:', data.results.length);
      data.results.forEach((r: StoreResult, idx: number) => {
        console.log(`  [${idx}] ${r.storeName}: hasItem=${r.hasItem}`);
      });
      
      const results: StoreResult[] = data.results;
      setWebhookResults(results);

      if (results.length === 0) {
        setWebhookError(`No results found for "${webhookQuery}"`);
      } else {
        // If we got results, try to find user location to show nearest stores
        if (!userLocation) {
          await handleFindNearbyStores();
        }
      }
    } catch (error) {
      console.error('Product store search failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      setWebhookError(`Search failed: ${errorMessage}. Please try again.`);
    } finally {
      setWebhookLoading(false);
    }
  };

  // Handle finding nearest store using Google Places API
  const handleFindNearestStore = async (chainName: string) => {
    if (!navigator.geolocation) {
      toast({
        title: 'Location not available',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        console.log('User location:', latitude, longitude);
        console.log('Searching for:', chainName);

        // Verify Google Maps API is loaded
        if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
          toast({
            title: 'Maps API not loaded',
            description: 'Please try again in a moment.',
            variant: 'destructive',
          });
          return;
        }

        const service = new google.maps.places.PlacesService(
          document.createElement('div')
        );

        const openDestination = (place: google.maps.places.PlaceResult, fallbackLabel?: string) => {
          const dest = place.geometry?.location;
          if (!dest) {
            toast({
              title: 'Location error',
              description: 'Could not get store location.',
              variant: 'destructive',
            });
            return;
          }

          const isOpen = typeof place.opening_hours?.isOpen === 'function'
            ? place.opening_hours.isOpen()
            : place.opening_hours?.open_now;

          setSelectedDestination({
            lat: dest.lat(),
            lng: dest.lng(),
            name: place.name || fallbackLabel || chainName,
            address: place.vicinity,
            rating: place.rating,
            isOpen,
          });
          setSelectedMapStore(null);
          setShowMapModal(true);
        };

        const fallbackToNearestSupermarket = () => {
          const fallbackRequest = {
            location: new google.maps.LatLng(latitude, longitude),
            rankBy: google.maps.places.RankBy.DISTANCE,
            type: 'supermarket',
          } as const;

          service.nearbySearch(
            fallbackRequest,
            (fallbackResults: google.maps.places.PlaceResult[] | null, fallbackStatus: google.maps.places.PlacesServiceStatus) => {
              if (fallbackStatus === google.maps.places.PlacesServiceStatus.OK && fallbackResults && fallbackResults.length > 0) {
                openDestination(fallbackResults[0], 'Nearest supermarket');
              } else {
                toast({
                  title: 'No nearby stores found',
                  description: 'Unable to locate a nearby store right now.',
                  variant: 'destructive',
                });
              }
            }
          );
        };

        const request = {
          location: new google.maps.LatLng(latitude, longitude),
          rankBy: google.maps.places.RankBy.DISTANCE,
          keyword: `${chainName} supermarket`,
          type: 'supermarket',
        };

        service.nearbySearch(
          request,
          (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
              fallbackToNearestSupermarket();
              return;
            }

            const normalizedChain = chainName.toLowerCase();
            const brandMatches = results.filter((place) => (place.name || '').toLowerCase().includes(normalizedChain));
            const chosen = brandMatches[0] || results[0];

            if (!brandMatches.length) {
              toast({
                title: 'Exact store not nearby',
                description: `No ${chainName} found nearby. Showing the closest supermarket instead.`,
              });
            }

            openDestination(chosen);
          }
        );
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: 'Location access denied',
          description: 'Please enable location access to find nearest stores.',
          variant: 'destructive',
        });
      }
    );
  };

  // Find nearest stores for chains using Google Places
  const findNearestStoresForChains = async (chains: string[], userLatLng: { lat: number; lng: number }) => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('Google Places API key not configured');
      return;
    }

    const newNearestByChain: Record<string, NearbyStore | null> = {};

    for (const chainId of chains) {
      try {
        const displayName = CHAIN_DISPLAY_NAME[chainId];
        if (!displayName) continue;

        const url = 'http://localhost:3001/api/places/searchText';
        const requestBody = {
          textQuery: `${displayName} supermarket`,
          includedType: "supermarket",
          maxResultCount: 5,
          locationRestriction: {
            circle: {
              center: {
                latitude: userLatLng.lat,
                longitude: userLatLng.lng
              },
              radius: 10000.0 // 10km radius
            }
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours'
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const result = await response.json();
          const places = result.places || [];
          // Find the closest one
          if (places.length > 0) {
            newNearestByChain[chainId] = places[0];
          }
        }
      } catch (error) {
        console.error(`Error finding nearest ${chainId} store:`, error);
      }
    }

    setNearestByChain(newNearestByChain);
  };



  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Store Locator</h1>
        <p className="text-muted-foreground">Find stores in Singapore</p>
      </div>

      {/* Search Card */}
      <Card className="magnet-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Search className="h-5 w-5" />
            Find Stores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Input
                id="area"
                placeholder="e.g., Woodlands, Orchard, Central"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-type">Store Type</Label>
              <Select value={selectedStoreType} onValueChange={setSelectedStoreType}>
                <SelectTrigger id="store-type">
                  <SelectValue placeholder="Select store type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  <SelectItem value="supermarket">Supermarkets</SelectItem>
                  <SelectItem value="convenience_store">Convenience Stores</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={searching} className="w-full">
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Find Nearby Stores Button - Outside container with orange color */}
      <div className="flex items-center gap-4">
        <Button 
          onClick={handleFindNearbyStores} 
          disabled={nearbyLoading} 
          className="bg-primary hover:bg-primary/90"
        >
          {nearbyLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <MapPin className="h-4 w-4 mr-2" />
          )}
          Find Stores Near Me
        </Button>
        {nearbyError && (
          <p className="text-sm text-destructive">{nearbyError}</p>
        )}
      </div>

      {/* Webhook Product Search Card */}
      <Card className="magnet-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <ShoppingCart className="h-5 w-5" />
            Find Product at Stores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search for a product..."
              value={webhookQuery}
              onChange={(e) => {
                setWebhookQuery(e.target.value);
                setWebhookError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleFindClick()}
            />
            <Button 
              onClick={handleFindClick} 
              disabled={webhookLoading}
            >
              {webhookLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Find</span>
            </Button>
          </div>

          {webhookLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <span>Searching stores...</span>
            </div>
          )}

          {webhookError && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              {webhookError}
            </div>
          )}

          {webhookResults.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Nearest store that might sell this product:</h3>
                {webhookResults.map((result, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold">{result.storeName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={result.hasItem ? 'default' : 'secondary'}>
                          {result.hasItem ? '✓ Has item' : '✗ Not found'}
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleFindNearestStore(result.storeName)}
                    >
                      Find nearest store
                    </Button>
                  </div>
                ))}
              </div>

              {/* Show location prompt if not already fetched */}
              {!userLocation && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900 mb-2">
                    Enable location to find the nearest store with this product
                  </p>
                  <Button 
                    size="sm" 
                    onClick={handleFindNearbyStores}
                    disabled={nearbyLoading}
                    variant="outline"
                  >
                    {nearbyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <MapPin className="h-4 w-4 mr-2" />
                    )}
                    Use my location
                  </Button>
                </div>
              )}

              {/* Removed nearest stores summary to simplify product section */}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Search Results */}
      {initialSearch && (
        <Card className="magnet-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <ShoppingCart className="h-5 w-5" />
              Products for "{initialSearch}"
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productSearchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                Searching for products...
              </div>
            ) : productResults.length > 0 ? (
              <div className="space-y-3">
                {productResults.slice(0, 5).map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="font-medium">
                        {highlightKeywords(product.title, initialSearch.split(/\s+/).filter(w => w.length > 0))}
                      </p>
                      {product.hasItem && product.price && (
                        <p className="text-sm text-muted-foreground">
                          {product.price} {product.measurement && `• ${product.measurement}`}
                        </p>
                      )}
                    </div>
                    {product.hasItem && product.link && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleFindNearestStore(product.supermarket)}
                      >
                        Find nearest store
                      </Button>
                    )}
                  </div>
                ))}
                {productResults.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    And {productResults.length - 5} more products found
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No products found for "{initialSearch}"
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Removed: Stores with Item section - replaced by webhook results above */}

      {/* Filters */}
      {(filteredResults.length > 0 || filteredNearbyStores.length > 0) && (
        <Filters
          distanceFilter={distanceFilter}
          ratingFilter={ratingFilter}
          onDistanceChange={setDistanceFilter}
          onRatingChange={setRatingFilter}
        />
      )}

      {/* Two-Column Results Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Stores in {searchLocation} */}
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">
            Stores in {selectedArea || 'Search Area'}
          </h2>
          {filteredResults.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1">
              {filteredResults.map((store, idx) => (
                <StoreCard
                  key={`search-${idx}`}
                  store={store}
                  userLocation={userLocation}
                  onNavigate={openInGoogleMaps}
                />
              ))}
            </div>
          ) : (
            <Card className="magnet-card">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  {selectedArea ? `No stores found in ${selectedArea}` : 'Search for stores in an area above'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Nearby Stores */}
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">
            Nearby Stores & Supermarkets
          </h2>
          {filteredNearbyStores.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1">
              {filteredNearbyStores.map((store, idx) => (
                <StoreCard
                  key={`nearby-${idx}`}
                  store={store}
                  userLocation={userLocation}
                  onNavigate={openInGoogleMaps}
                />
              ))}
            </div>
          ) : (
            <Card className="magnet-card">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  {nearbyError
                    ? nearbyError
                    : userLocation
                      ? 'No nearby stores found'
                      : 'Click "Find Stores Near Me" to discover nearby supermarkets'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* In-App Map Modal with Detailed Directions */}
      {showMapModal && (selectedMapStore || selectedDestination) && (
        <InAppMap
          isOpen={showMapModal}
          onClose={() => {
            setShowMapModal(false);
            setSelectedMapStore(null);
            setSelectedDestination(null);
          }}
          destination={selectedDestination || (selectedMapStore ? {
            lat: selectedMapStore.location.latitude,
            lng: selectedMapStore.location.longitude,
            name: selectedMapStore.displayName.text,
            address: selectedMapStore.formattedAddress,
            rating: selectedMapStore.rating,
            isOpen: selectedMapStore.currentOpeningHours?.openNow
          } : undefined)}
          origin={userLocation ?? undefined}
        />
      )}
    </div>
  );
};

export default StoreLocator;
