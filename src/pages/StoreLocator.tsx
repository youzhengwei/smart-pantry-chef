import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getStores } from '@/services/firebaseService';
import { Store, NearbyStore } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { 
  MapPin, 
  Search, 
  Loader2, 
  Store as StoreIcon,
  Check,
  X,
  ShoppingCart,
  Sparkles,
  Navigation
} from 'lucide-react';

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
  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStoreType, setSelectedStoreType] = useState('all');

  // Get initial search from navigation state
  const initialSearch = (location.state as { searchItem?: string })?.searchItem || '';

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
    // Navigate with directions from user location to store
    const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : '';
    const destination = `${store.location.latitude},${store.location.longitude}`;
    const url = `https://www.google.com/maps/dir/${origin}/${destination}`;
    window.open(url, '_blank');
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
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Store Locator</h1>
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
                  <SelectItem value="all">All (Supermarkets & Convenience)</SelectItem>
                  <SelectItem value="supermarket">Supermarket/Market</SelectItem>
                  <SelectItem value="convenience_store">Convenience Store</SelectItem>
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
                    Find Stores
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
          {nearbyStores.length > 0 && (
            <>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="openOnly"
                  checked={showOpenOnly}
                  onChange={(e) => setShowOpenOnly(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="openOnly">Show only open stores</Label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(showOpenOnly ? nearbyStores.filter(store => store.currentOpeningHours?.openNow) : nearbyStores).map((store, idx) => (
                  <Card key={idx} className="magnet-card overflow-hidden">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <StoreIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{store.displayName.text}</p>
                            <p className="text-xs text-muted-foreground">{store.formattedAddress}</p>
                            {userLocation && (() => {
                              const distance = calculateDistance(userLocation.lat, userLocation.lng, store.location.latitude, store.location.longitude);
                              const travelTimes = getEstimatedTravelTime(distance);
                              return (
                                <div className="text-xs text-muted-foreground space-y-1">
                                  <p>{distance.toFixed(1)} km away</p>
                                  <p>🚶 {travelTimes.walking} • 🚗 {travelTimes.driving}</p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openInGoogleMaps(store)}
                        >
                          <Navigation className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {store.rating && (
                            <Badge variant="outline" className="text-xs">
                              ⭐ {store.rating}
                            </Badge>
                          )}
                          {store.currentOpeningHours?.openNow !== undefined && (
                            <Badge variant={store.currentOpeningHours.openNow ? 'default' : 'secondary'} className="text-xs">
                              {store.currentOpeningHours.openNow ? 'Open now' : 'Closed'}
                            </Badge>
                          )}
                        </div>
                        <Badge className="status-fresh text-xs">
                          <StoreIcon className="mr-1 h-3 w-3" /> Store Available
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">
            Stores in {selectedArea} ({results.length} result{results.length !== 1 ? 's' : ''})
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((store, idx) => (
              <Card key={idx} className="magnet-card overflow-hidden">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <StoreIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{store.displayName.text}</p>
                        <p className="text-xs text-muted-foreground">{store.formattedAddress}</p>
                        {userLocation && (() => {
                          const distance = calculateDistance(userLocation.lat, userLocation.lng, store.location.latitude, store.location.longitude);
                          const travelTimes = getEstimatedTravelTime(distance);
                          return (
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>{distance.toFixed(1)} km away</p>
                              <p>🚶 {travelTimes.walking} • 🚗 {travelTimes.driving}</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openInGoogleMaps(store)}
                    >
                      <Navigation className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {store.rating && (
                        <Badge variant="outline" className="text-xs">
                          ⭐ {store.rating}
                        </Badge>
                      )}
                      {store.currentOpeningHours?.openNow !== undefined && (
                        <Badge variant={store.currentOpeningHours.openNow ? 'default' : 'secondary'} className="text-xs">
                          {store.currentOpeningHours.openNow ? 'Open now' : 'Closed'}
                        </Badge>
                      )}
                    </div>
                    <Badge className="status-fresh text-xs">
                      <StoreIcon className="mr-1 h-3 w-3" /> Store Available
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !searching && (
        <Card className="magnet-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-display text-xl font-semibold">Find stores in Singapore</h3>
            <p className="text-center text-muted-foreground">
              Select a store type (All = Supermarkets + Convenience stores) and enter an area in Singapore to find more stores nearby.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StoreLocator;
