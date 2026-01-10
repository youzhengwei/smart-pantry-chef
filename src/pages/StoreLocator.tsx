import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getStores } from '@/services/firebaseService';
import { Store, NearbyStore } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin, 
  Search, 
  Loader2,
  ShoppingCart,
} from 'lucide-react';
import StoreCard from '@/components/StoreCard';
import Filters from '@/components/Filters';
import InAppMap from '@/components/InAppMap';

const StoreLocator: React.FC = () => {
  const location = useLocation();
  const { toast } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [results, setResults] = useState<NearbyStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [selectedArea, setSelectedArea] = useState('');
  const [nearbyStores, setNearbyStores] = useState<NearbyStore[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStoreType, setSelectedStoreType] = useState('all');
  const [distanceFilter, setDistanceFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [selectedStoreForMap, setSelectedStoreForMap] = useState<NearbyStore | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);

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
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const storesData = await getStores();
      setStores(storesData);
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered results
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
    setSelectedStoreForMap(store);
    setIsMapOpen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

      {/* Nearby Stores Card */}
      <Card className="magnet-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <MapPin className="h-5 w-5" />
            Nearby Stores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleFindNearbyStores} disabled={nearbyLoading}>
            {nearbyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="mr-2 h-4 w-4" />
            )}
            Use my location
          </Button>
          {nearbyError && <p className="text-destructive">{nearbyError}</p>}
        </CardContent>
      </Card>

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

        {/* Right Column: Stores near me */}
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Stores near me</h2>
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
                  {nearbyError ? nearbyError : 'Use your location to find nearby stores'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* In-App Map Modal */}
      <InAppMap
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        store={selectedStoreForMap}
        userLocation={userLocation}
      />
    </div>
  );
};

export default StoreLocator;
