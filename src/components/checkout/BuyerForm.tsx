import { User, Phone, MapPin, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { BuyerInfo } from '@/lib/types';

interface BuyerFormProps {
  buyerInfo: BuyerInfo;
  onChange: (info: BuyerInfo) => void;
}

export function BuyerForm({ buyerInfo, onChange }: BuyerFormProps) {
  const updateField = (field: keyof BuyerInfo, value: string | number | null) => {
    onChange({ ...buyerInfo, [field]: value });
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

      {/* Delivery Address */}
      <div className="space-y-2">
        <Label htmlFor="address" className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          Delivery Address
        </Label>
        <Input
          id="address"
          placeholder="e.g. Mikocheni, Regent Estate, Dar es Salaam"
          value={buyerInfo.delivery_address}
          onChange={(e) => updateField('delivery_address', e.target.value)}
          className="h-12"
        />
      </div>

      {/* Coordinates — hidden inputs, will be populated by map/geolocation in future */}
      {/* For now buyers enter lat/lng manually or we use defaults */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="lat" className="text-muted-foreground text-xs">
            Latitude (optional)
          </Label>
          <Input
            id="lat"
            type="number"
            step="any"
            placeholder="-6.7924"
            value={buyerInfo.delivery_lat ?? ''}
            onChange={(e) => updateField('delivery_lat', e.target.value ? parseFloat(e.target.value) : null)}
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lng" className="text-muted-foreground text-xs">
            Longitude (optional)
          </Label>
          <Input
            id="lng"
            type="number"
            step="any"
            placeholder="39.2083"
            value={buyerInfo.delivery_lng ?? ''}
            onChange={(e) => updateField('delivery_lng', e.target.value ? parseFloat(e.target.value) : null)}
            className="h-10 text-sm"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Coordinates help us estimate delivery cost more accurately
      </p>

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
