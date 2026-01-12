import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { NearbyStore } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

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
        const convenienceQuery = `convenience stores in ${selectedArea.trim()}, Hong Kong or Singapore`;
        const chainsQuery = `7-eleven or cheers or choices in ${selectedArea.trim()}, Hong Kong or Singapore`;

        // Search 1: General convenience stores
        const convRequestBody = {
          textQuery: convenienceQuery,
          includedType: "convenience_store",
          maxResultCount: 25,
          locationRestriction: {
            rectangle: {
              low: { latitude: 1.1, longitude: 103.5 },
              high: { latitude: 22.6, longitude: 114.5 }
            }
          }
        };

        // Search 2: Specific convenience chains
        const chainsRequestBody = {
          textQuery: chainsQuery,
          maxResultCount: 25,
          locationRestriction: {
            rectangle: {
              low: { latitude: 1.1, longitude: 103.5 },
              high: { latitude: 22.6, longitude: 114.5 }
            }
          }
        };

        const [convResponse, chainsResponse] = await Promise.all([
          fetch(`https://places.googleapis.com/v1/places:searchText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours'
            },
            body: JSON.stringify(convRequestBody)
          }),
          fetch(`https://places.googleapis.com/v1/places:searchText`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours'
            },
            body: JSON.stringify(chainsRequestBody)
          })
        ]);

        if (!convResponse.ok || !chainsResponse.ok) {
          throw new Error('Places API search failed');
        }

        const convResult = await convResponse.json();
        const chainsResult = await chainsResponse.json();

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
        const url = `https://places.googleapis.com/v1/places:searchText`;
        const requestBody: any = {
          textQuery: selectedStoreType === 'all' 
            ? `supermarkets and convenience stores in ${selectedArea.trim()}, Hong Kong or Singapore`
            : `${selectedStoreType.replace('_', ' ')} in ${selectedArea.trim()}, Hong Kong or Singapore`,
          maxResultCount: 50,
          locationRestriction: {
            rectangle: {
              low: { latitude: 1.1, longitude: 103.5 },
              high: { latitude: 22.6, longitude: 114.5 }
            }
          }
        };

        // Only use includedType for convenience_store, not for supermarket to get more results
        if (selectedStoreType !== 'all' && selectedStoreType !== 'supermarket') {
          requestBody.includedType = selectedStoreType;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Places API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        allStores = result.places || [];
      }

      // Filter to only include stores in Hong Kong or Singapore
      const stores = allStores.filter((store: NearbyStore) => {
        const address = store.formattedAddress.toLowerCase();
        const name = store.displayName.text.toLowerCase();
        const searchArea = selectedArea.trim().toLowerCase();

        // Check if address contains HK/SG indicators
        const hasHKSG = address.includes('singapore') || address.includes('hong kong') ||
                       address.includes('hk') || address.includes('sg') ||
                       address.includes('singapore ') || address.includes('hong kong ');

        // Additional check: coordinates should be within HK/SG bounds
        const inBounds = (
          (store.location.latitude >= 1.1 && store.location.latitude <= 1.5 &&
           store.location.longitude >= 103.5 && store.location.longitude <= 104.1) || // Singapore
          (store.location.latitude >= 22.1 && store.location.latitude <= 22.6 &&
           store.location.longitude >= 113.8 && store.location.longitude <= 114.5)   // Hong Kong
        );

        // Additional check: address should contain the searched area (to avoid irrelevant results)
        const hasSearchArea = address.includes(searchArea) || 
                             name.includes(searchArea) ||
                             // Handle common area variations
                             (searchArea === 'woodlands' && (address.includes('woodlands') || address.includes('woodland'))) ||
                             (searchArea === 'yishun' && (address.includes('yishun') || address.includes('yishan'))) ||
                             (searchArea === 'central' && address.includes('central')) ||
                             (searchArea === 'orchard' && address.includes('orchard'));

        // Exclude specific unwanted stores
        const isExcludedStore = name.includes('homekong mart') || name.includes('鄉港旺舖');

        return (hasHKSG || inBounds) && hasSearchArea && !isExcludedStore;
      });

      setResults(stores);

      if (stores.length === 0) {
        toast({
          title: 'No stores found',
          description: `No stores found in "${selectedArea}". Try a different area name or check spelling.`,
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

      const url = 'https://places.googleapis.com/v1/places:searchNearby';
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
          'X-Goog-Api-Key': apiKey,
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
                       address.includes('singapore ') || address.includes('hong kong ');

        // Additional check: coordinates should be within HK/SG bounds
        const inBounds = (
          (store.location.latitude >= 1.1 && store.location.latitude <= 1.5 &&
           store.location.longitude >= 103.5 && store.location.longitude <= 104.1) || // Singapore
          (store.location.latitude >= 22.1 && store.location.latitude <= 22.6 &&
           store.location.longitude >= 113.8 && store.location.longitude <= 114.5)   // Hong Kong
        );

        return hasHKSG || inBounds;
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
    setShowMapModal(true);
  };

  // Chain display names mapping
  const CHAIN_DISPLAY_NAME: Record<string, string> = {
    ntuc: 'NTUC FairPrice',
    'cold-storage': 'Cold Storage',
    'sheng-siong': 'Sheng Siong',
  };

  // Search for products using the backend
  const searchProducts = async (query: string) => {
    setProductSearchLoading(true);
    try {
      // Use environment variable or fallback to local development server
      const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:3000/search-products';

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Product search failed: ${response.status}`);
      }

      const data = await response.json();
      const results: ProductSearchResult[] = data.results || [];

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
    // Validate query is not empty
    if (!webhookQuery.trim()) {
      setWebhookError('Please enter a product name');
      return;
    }

    // Check if N8N webhook URL is configured
    if (!N8N_WEBHOOK_URL) {
      console.error('N8N_WEBHOOK_URL environment variable is not configured');
      setWebhookError('Product search service is not configured');
      return;
    }

    setWebhookLoading(true);
    setWebhookError(null);
    setWebhookResults([]);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: webhookQuery }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const results: StoreResult[] = data.results || [];
      setWebhookResults(results);

      if (results.length === 0) {
        setWebhookError(`No results found for "${webhookQuery}"`);
      }
    } catch (error) {
      console.error('Webhook search error:', error);
      setWebhookError(
        error instanceof Error ? error.message : 'Failed to search for products. Please try again.'
      );
    } finally {
      setWebhookLoading(false);
    }
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

        const url = 'https://places.googleapis.com/v1/places:searchText';
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
            'X-Goog-Api-Key': apiKey,
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
            <div className="space-y-2">
              {webhookResults.map((result, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold">{result.storeName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={result.hasItem ? 'default' : 'secondary'}>
                        {result.hasItem ? 'Has item' : 'Not found'}
                      </Badge>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    asChild
                  >
                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                      Open store page
                    </a>
                  </Button>
                </div>
              ))}
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
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{product.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.price} {product.measurement && `• ${product.measurement}`}
                      </p>
                    </div>
                    {product.link && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={product.link} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
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

      {/* Stores with Item */}
      {chainsWithItem.length > 0 && (
        <Card className="magnet-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <MapPin className="h-5 w-5" />
              Stores with "{initialSearch}"
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!userLocation && (
              <Button onClick={handleFindNearbyStores} disabled={nearbyLoading}>
                {nearbyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                Use my location to find nearest stores
              </Button>
            )}
            {userLocation && Object.keys(nearestByChain).length > 0 ? (
              <div className="space-y-3">
                {chainsWithItem.map((chainId) => {
                  const store = nearestByChain[chainId];
                  const displayName = CHAIN_DISPLAY_NAME[chainId] || chainId;

                  if (!store) {
                    return (
                      <div key={chainId} className="p-3 border rounded-lg">
                        <p className="font-medium">{displayName}</p>
                        <p className="text-sm text-muted-foreground">No nearby store found</p>
                      </div>
                    );
                  }

                  const distance = calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    store.location.latitude,
                    store.location.longitude
                  );

                  return (
                    <div key={chainId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{store.displayName?.text || displayName}</p>
                        <p className="text-sm text-muted-foreground">
                          {store.formattedAddress}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {distance.toFixed(1)} km away
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${store.location.latitude},${store.location.longitude}`;
                          window.open(url, '_blank');
                        }}
                      >
                        <Navigation className="h-4 w-4 mr-1" />
                        Navigate
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : userLocation ? (
              <p className="text-muted-foreground text-center py-4">
                Searching for stores with this item...
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

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

        {/* Right Column: Stores with Item or Stores near me */}
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">
            {chainsWithItem.length > 0 ? `Stores with "${initialSearch || 'item'}"` : 'Stores near me'}
          </h2>
          {chainsWithItem.length > 0 ? (
            Object.keys(nearestByChain).length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-1">
                {chainsWithItem.map((chainId) => {
                  const store = nearestByChain[chainId];
                  const displayName = CHAIN_DISPLAY_NAME[chainId] || chainId;

                  if (!store) return null;

                  const distance = calculateDistance(
                    userLocation?.lat || 0,
                    userLocation?.lng || 0,
                    store.location.latitude,
                    store.location.longitude
                  );

                  // Convert to NearbyStore format for StoreCard
                  const nearbyStore: NearbyStore = {
                    displayName: { text: store.displayName?.text || displayName },
                    formattedAddress: store.formattedAddress || '',
                    location: {
                      latitude: store.location.latitude,
                      longitude: store.location.longitude
                    },
                    rating: store.rating,
                    currentOpeningHours: store.currentOpeningHours
                  };

                  return (
                    <StoreCard
                      key={`chain-${chainId}`}
                      store={nearbyStore}
                      userLocation={userLocation}
                      onNavigate={openInGoogleMaps}
                    />
                  );
                })}
              </div>
            ) : (
              <Card className="magnet-card">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    {userLocation ? 'Finding stores with this item...' : 'Use your location to find stores with this item'}
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            filteredNearbyStores.length > 0 ? (
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
                    {nearbyError ? nearbyError : 'Use your location to find nearby stores'}
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>

      {/* In-App Map Modal with Detailed Directions */}
      {selectedMapStore && (
        <InAppMap
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          destination={{
            lat: selectedMapStore.location.latitude,
            lng: selectedMapStore.location.longitude,
            name: selectedMapStore.displayName.text,
            address: selectedMapStore.formattedAddress,
            rating: selectedMapStore.rating,
            isOpen: selectedMapStore.currentOpeningHours?.openNow
          }}
          origin={userLocation ?? undefined}
        />
      )}

      {/* Map Modal */}
      <Dialog open={showMapModal} onOpenChange={setShowMapModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {selectedMapStore?.displayName.text}
            </DialogTitle>
          </DialogHeader>
          
          {selectedMapStore && (
            <div className="space-y-4">
              {/* Store Info */}
              <div className="rounded-lg border p-4 bg-muted/50">
                <p className="text-sm text-foreground mb-2">
                  <strong>Address:</strong> {selectedMapStore.formattedAddress}
                </p>
                {selectedMapStore.rating && (
                  <p className="text-sm text-foreground mb-2">
                    <strong>Rating:</strong> ⭐ {selectedMapStore.rating}
                  </p>
                )}
                {selectedMapStore.currentOpeningHours?.openNow !== undefined && (
                  <p className="text-sm text-foreground">
                    <strong>Status:</strong>{' '}
                    <Badge variant={selectedMapStore.currentOpeningHours.openNow ? 'default' : 'secondary'} className="ml-1">
                      {selectedMapStore.currentOpeningHours.openNow ? 'Open now' : 'Closed'}
                    </Badge>
                  </p>
                )}
              </div>

              {/* Embedded Map */}
              <div className="rounded-lg overflow-hidden border">
                <iframe
                  title={selectedMapStore.displayName.text}
                  width="100%"
                  height="500"
                  frameBorder={0}
                  src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&q=${encodeURIComponent(selectedMapStore.displayName.text)}+${encodeURIComponent(selectedMapStore.formattedAddress)}`}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              {/* Directions Link */}
              <div className="flex gap-2">
                <Button 
                  className="flex-1"
                  onClick={() => {
                    const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : '';
                    const destination = `${selectedMapStore.location.latitude},${selectedMapStore.location.longitude}`;
                    const url = `https://www.google.com/maps/dir/${origin}/${destination}`;
                    window.open(url, '_blank');
                  }}
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  Get Directions (Opens Google Maps)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreLocator;
