import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NearbyStore } from '@/types';
import { Car, Footprints, Bike, Clock, Route, Navigation, MapPin, Heart } from 'lucide-react';

interface InAppMapProps {
  isOpen: boolean;
  onClose: () => void;
  destination?: { lat: number; lng: number; name?: string; address?: string; rating?: number; isOpen?: boolean };
  origin?: { lat: number; lng: number };
  store?: NearbyStore | null;
  userLocation?: { lat: number; lng: number } | null;
}

interface RouteInfo {
  mode: 'driving' | 'walking' | 'bicycling' | 'transit';
  duration: string;
  distance: string;
  summary?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

const InAppMap: React.FC<InAppMapProps> = ({ isOpen, onClose, store, userLocation, destination, origin }) => {
  // Handle both old (store/userLocation) and new (destination/origin) prop styles
  const actualStore = store || (destination ? {
    displayName: { text: destination.name || 'Destination' },
    formattedAddress: destination.address || '',
    location: { latitude: destination.lat, longitude: destination.lng },
    rating: destination.rating,
    currentOpeningHours: { openNow: destination.isOpen }
  } as NearbyStore : null);
  
  const actualUserLocation = userLocation || origin;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const [selectedMode, setSelectedMode] = useState<'driving' | 'walking' | 'bicycling' | 'transit'>('driving');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoadingDirections, setIsLoadingDirections] = useState(false);

  useEffect(() => {
    if (isOpen && actualStore && !window.google) {
      // Load Google Maps API with Directions service
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => {
        initializeMap();
      };
    } else if (isOpen && actualStore && window.google && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [isOpen, actualStore]);

  // Handle travel mode changes
  useEffect(() => {
    if (isOpen && actualUserLocation && actualStore && mapInstanceRef.current) {
      calculateRoute(selectedMode);
    }
  }, [selectedMode, isOpen]);

  const initializeMap = () => {
    if (!mapRef.current || !actualStore) return;

    console.log('Initializing map with store:', actualStore.displayName.text);

    const mapOptions = {
      center: {
        lat: actualStore.location.latitude,
        lng: actualStore.location.longitude,
      },
      zoom: 15,
    };

    try {
      const map = new window.google.maps.Map(mapRef.current, mapOptions);
      mapInstanceRef.current = map; // Store map instance
      console.log('Map initialized successfully');

      // Add store marker
      const marker = new window.google.maps.Marker({
        position: {
          lat: actualStore.location.latitude,
          lng: actualStore.location.longitude,
        },
        map: map,
        title: actualStore.displayName.text,
      });

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div>
            <h3>${actualStore.displayName.text}</h3>
            <p>${actualStore.formattedAddress}</p>
            ${actualStore.rating ? `<p>Rating: ⭐ ${actualStore.rating}</p>` : ''}
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      // Initialize directions renderer only once
      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          map: map,
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: '#E07547',
            strokeWeight: 5,
          },
        });
      }

      // If user location exists, calculate initial route
      if (actualUserLocation) {
        console.log('Calculating initial route...');
        calculateRoute(selectedMode);
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const calculateRoute = (travelMode: 'driving' | 'walking' | 'bicycling' | 'transit') => {
    if (!actualUserLocation || !actualStore) {
      console.log('Missing location or store for route calculation');
      return;
    }

    if (!directionsRendererRef.current || !mapInstanceRef.current) {
      console.log('Directions renderer or map not initialized');
      return;
    }

    setIsLoadingDirections(true);
    console.log('Calculating route with mode:', travelMode);

    const directionsService = new window.google.maps.DirectionsService();

    const request = {
      origin: new window.google.maps.LatLng(actualUserLocation.lat, actualUserLocation.lng),
      destination: new window.google.maps.LatLng(actualStore.location.latitude, actualStore.location.longitude),
      travelMode: window.google.maps.TravelMode[travelMode.toUpperCase()],
      provideRouteAlternatives: false,
    };

    directionsService.route(request, (result: any, status: any) => {
      setIsLoadingDirections(false);

      if (status === window.google.maps.DirectionsStatus.OK && result?.routes?.[0]) {
        console.log('Route calculated successfully:', result);
        directionsRendererRef.current.setDirections(result);
        
        const route = result.routes[0];
        const leg = route.legs[0];
        
        setRouteInfo({
          mode: travelMode,
          duration: leg.duration.text,
          distance: leg.distance.text,
          summary: route.summary,
        });
      } else {
        console.error('Directions request failed:', status);
        setRouteInfo(null);
      }
    });
  };

  const handleModeChange = (mode: 'driving' | 'walking' | 'bicycling' | 'transit') => {
    setSelectedMode(mode);
    calculateRoute(mode);
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'driving': return <Car className="h-4 w-4" />;
      case 'walking': return <Footprints className="h-4 w-4" />;
      case 'bicycling': return <Bike className="h-4 w-4" />;
      case 'transit': return <Route className="h-4 w-4" />;
      default: return <Car className="h-4 w-4" />;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'driving': return 'Driving';
      case 'walking': return 'Walking';
      case 'bicycling': return 'Cycling';
      case 'transit': return 'Public Transport';
      default: return 'Driving';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
          Directions to {actualStore?.displayName.text}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden p-6">
          {/* Map Section */}
          <div className="flex-1 rounded-lg overflow-hidden bg-gray-100 relative">
            <div ref={mapRef} className="w-full h-full absolute inset-0" />
          </div>

          {/* Directions Panel */}
          <div className="w-80 space-y-4 overflow-y-auto max-h-full">
            {/* Travel Mode Selection */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">How would you like to travel?</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(['driving', 'walking', 'bicycling', 'transit'] as const).map((mode) => (
                    <Button
                      key={mode}
                      variant={selectedMode === mode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleModeChange(mode)}
                      className={`flex items-center gap-2 ${selectedMode === mode ? 'bg-primary hover:bg-primary/90' : ''}`}
                      disabled={isLoadingDirections}
                    >
                      {getModeIcon(mode)}
                      {getModeLabel(mode)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Route Information */}
            {routeInfo && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {getModeIcon(routeInfo.mode)}
                    <h3 className="font-medium">Your {getModeLabel(routeInfo.mode)} route</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{routeInfo.duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{routeInfo.distance}</span>
                    </div>
                    {routeInfo.summary && (
                      <Badge variant="outline" className="text-xs">
                        {routeInfo.summary}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Store Details */}
            {store && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-2">Destination</h3>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{store.displayName.text}</p>
                    <p className="text-xs text-muted-foreground">{store.formattedAddress}</p>
                    {store.rating && (
                      <Badge variant="outline" className="text-xs">
                        ⭐ {store.rating}
                      </Badge>
                    )}
                    {store.currentOpeningHours?.openNow !== undefined && (
                      <Badge 
                        className="bg-white text-gray-800 border border-gray-300 text-xs"
                      >
                        {store.currentOpeningHours.openNow ? 'Open now' : 'Closed'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {!actualUserLocation && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Enable location services to see directions and travel times.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InAppMap;