import { useMemo } from 'react';
import { User, Phone, MapPin, MessageSquare, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPrice } from '@/lib/format';
import type { BuyerInfo, DeliveryFeeData } from '@/lib/types';

// Fallback cities only used when backend returns nothing
const TZ_CITIES_FALLBACK = [
  "Arusha","Dar es Salaam","Dodoma","Mbeya","Mwanza","Tanga","Morogoro","Zanzibar City"
].sort();

interface BuyerFormProps {
  buyerInfo: BuyerInfo;
  onChange: (info: BuyerInfo) => void;
  feeData?: DeliveryFeeData | null;
}

export function BuyerForm({ buyerInfo, onChange, feeData }: BuyerFormProps) {
  const cities = useMemo(() => {
    if (feeData?.cities && feeData.cities.length > 0) {
      return feeData.cities;
    }
    return TZ_CITIES_FALLBACK.map((name) => ({ id: name, name }));
  }, [feeData]);

  // Zones available for the selected city
  const availableZones = useMemo(() => {
    if (!feeData?.zones || !buyerInfo.city) return [];
    return feeData.zones.filter((z) => z.city_id === buyerInfo.city);
  }, [feeData, buyerInfo.city]);

  const updateField = (field: keyof BuyerInfo, value: string) => {
    const updated = { ...buyerInfo, [field]: value };
    // Reset zone when city changes
    if (field === 'city') {
      updated.zone_id = '';
    }
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Delivery Details</h2>

      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="flex items-center gap-2 text-muted-foreground">
          <User className="w-4 h-4" />
          Full Name
        </Label>
        <Input
          id="name"
          placeholder="Enter your full name"
          value={buyerInfo.name}
          onChange={(e) => updateField('name', e.target.value)}
          className="h-12"
        />
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="flex items-center gap-2 text-muted-foreground">
          <Phone className="w-4 h-4" />
          Phone Number
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+255 7XX XXX XXX"
          value={buyerInfo.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          className="h-12"
        />
        <p className="text-xs text-muted-foreground">
          We'll send order updates to this number
        </p>
      </div>

      {/* City */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          City
        </Label>
        <Select value={buyerInfo.city || undefined} onValueChange={(v) => updateField('city', v)}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select your city" />
          </SelectTrigger>
          <SelectContent>
            {cities.length > 0 ? (
              cities.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))
            ) : (
              <SelectItem value="__no_city_available__" disabled>No cities available</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Zone (shown only when same-city zones exist for selected city) */}
      {availableZones.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-muted-foreground">
            <Navigation className="w-4 h-4" />
            Delivery Zone
          </Label>
          <Select value={buyerInfo.zone_id || undefined} onValueChange={(v) => updateField('zone_id', v)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select delivery zone" />
            </SelectTrigger>
            <SelectContent>
              {availableZones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.zone_name} — {formatPrice(z.fee)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Delivery fee depends on your zone
          </p>
        </div>
      )}

      {/* Area/Street */}
      <div className="space-y-2">
        <Label htmlFor="area" className="text-muted-foreground">
          Area / Street
        </Label>
        <Input
          id="area"
          placeholder="e.g. Mikocheni, Regent Estate"
          value={buyerInfo.area}
          onChange={(e) => updateField('area', e.target.value)}
          className="h-12"
        />
      </div>

      {/* Landmark */}
      <div className="space-y-2">
        <Label htmlFor="landmark" className="text-muted-foreground">
          Landmark (optional)
        </Label>
        <Input
          id="landmark"
          placeholder="e.g. Near Shoppers Plaza"
          value={buyerInfo.landmark}
          onChange={(e) => updateField('landmark', e.target.value)}
          className="h-12"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="flex items-center gap-2 text-muted-foreground">
          <MessageSquare className="w-4 h-4" />
          Delivery Notes (optional)
        </Label>
        <Textarea
          id="notes"
          placeholder="Any special instructions for delivery..."
          value={buyerInfo.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          className="min-h-[80px] resize-none"
        />
      </div>
    </div>
  );
}
