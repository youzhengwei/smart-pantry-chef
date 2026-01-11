import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface FiltersProps {
  distanceFilter: string;
  ratingFilter: string;
  onDistanceChange: (value: string) => void;
  onRatingChange: (value: string) => void;
}

const Filters: React.FC<FiltersProps> = ({
  distanceFilter,
  ratingFilter,
  onDistanceChange,
  onRatingChange,
}) => {
  return (
    <div className="flex gap-4 mb-4">
      <div className="space-y-2">
        <Label htmlFor="distance-filter">Distance</Label>
        <Select value={distanceFilter} onValueChange={onDistanceChange}>
          <SelectTrigger id="distance-filter" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All distances</SelectItem>
            <SelectItem value="1">Within 1 km</SelectItem>
            <SelectItem value="3">Within 3 km</SelectItem>
            <SelectItem value="5">Within 5 km</SelectItem>
            <SelectItem value="10">Within 10 km</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rating-filter">Rating</Label>
        <Select value={ratingFilter} onValueChange={onRatingChange}>
          <SelectTrigger id="rating-filter" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            <SelectItem value="4.0">4.0+</SelectItem>
            <SelectItem value="3.0">3.0+</SelectItem>
            <SelectItem value="below3">Below 3</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default Filters;