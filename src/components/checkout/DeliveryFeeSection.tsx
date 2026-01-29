import { Truck, MapPin, AlertCircle } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SameCityZone, City } from '@/lib/types';

interface DeliveryFeeSectionProps {
  isSameCity: boolean;
  zones: SameCityZone[];
  selectedZoneId: string;
  onZoneSelect: (zoneId: string) => void;
  crossCityFee: number | null;
  vendorCityId: string | null;
  buyerCityId: string;
  cities: City[];
}

export function DeliveryFeeSection({
  isSameCity,
  zones,
  selectedZoneId,
  onZoneSelect,
  crossCityFee,
  vendorCityId,
  buyerCityId,
  cities,
}: DeliveryFeeSectionProps) {
  const buyerCity = cities.find((c) => c.id === buyerCityId);
  const vendorCity = cities.find((c) => c.id === vendorCityId);

  // No city selected yet
  if (!buyerCityId) {
    return (
      <div className="card-premium p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Delivery Fee</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Select your city to see delivery options
        </p>
      </div>
    );
  }

  // Same city delivery
  if (isSameCity) {
    return (
      <div className="card-premium p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Delivery Fee</h3>
          <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full ml-auto">
            Same City
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          Delivery within {buyerCity?.name}
        </p>

        {zones.length > 0 ? (
          <Select value={selectedZoneId} onValueChange={onZoneSelect}>
            <SelectTrigger className="h-12 bg-secondary border-0">
              <SelectValue placeholder="Select your area/zone" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  <div className="flex items-center justify-between w-full gap-4">
                    <span>{zone.zone_name}</span>
                    <span className="text-primary font-medium">
                      {formatPrice(zone.fee)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            No delivery zones configured for this city
          </div>
        )}
      </div>
    );
  }

  // Cross city delivery
  return (
    <div className="card-premium p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Delivery Fee</h3>
        <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full ml-auto">
          Cross City
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="w-4 h-4" />
        <span>
          {vendorCity?.name || 'Vendor location'} → {buyerCity?.name}
        </span>
      </div>

      {crossCityFee !== null ? (
        <div className="flex items-center justify-between bg-secondary rounded-lg p-3">
          <span className="text-sm">Delivery fee</span>
          <span className="text-primary font-semibold">
            {formatPrice(crossCityFee)}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4" />
          Delivery to this city is not available yet
        </div>
      )}
    </div>
  );
}
