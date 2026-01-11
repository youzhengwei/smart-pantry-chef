import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NearbyStore } from '@/types';
import { Store as StoreIcon, Navigation } from 'lucide-react';

interface StoreCardProps {
  store: NearbyStore;
  userLocation: { lat: number; lng: number } | null;
  onNavigate: (store: NearbyStore) => void;
}

const StoreCard: React.FC<StoreCardProps> = ({ store, userLocation, onNavigate }) => {
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getEstimatedTravelTime = (distanceKm: number) => {
    const walkingMinutes = Math.round((distanceKm / 5) * 60);
    const drivingMinutes = Math.round((distanceKm / 30) * 60);
    return {
      walking: walkingMinutes < 60 ? `${walkingMinutes} min walk` : `${Math.round(walkingMinutes/60)}h ${walkingMinutes%60}min walk`,
      driving: drivingMinutes < 60 ? `${drivingMinutes} min drive` : `${Math.round(drivingMinutes/60)}h ${drivingMinutes%60}min drive`
    };
  };

  const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, store.location.latitude, store.location.longitude) : null;
  const travelTimes = distance ? getEstimatedTravelTime(distance) : null;

  return (
    <Card className="magnet-card overflow-hidden">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <StoreIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">{store.displayName.text}</p>
              <p className="text-xs text-muted-foreground">{store.formattedAddress}</p>
              {distance && travelTimes && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{distance.toFixed(1)} km away</p>
                  <p>🚶 {travelTimes.walking} • 🚗 {travelTimes.driving}</p>
                </div>
              )}
            </div>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90"
            size="sm"
            onClick={() => onNavigate(store)}
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
              <Badge
                className="bg-white text-gray-800 border border-gray-300 text-xs"
              >
                {store.currentOpeningHours.openNow ? 'Open now' : 'Closed'}
              </Badge>
            )}
          </div>
          <Badge className="bg-white text-gray-800 border border-gray-300 text-xs">
            <StoreIcon className="mr-1 h-3 w-3" /> Store Available
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default StoreCard;