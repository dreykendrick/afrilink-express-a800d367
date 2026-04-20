import { User, Phone, MapPin, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPinSelector } from '@/components/checkout/MapPinSelector';
import type { BuyerInfo } from '@/lib/types';

interface BuyerFormProps {
  buyerInfo: BuyerInfo;
  onChange: (info: BuyerInfo) => void;
}

export function BuyerForm({ buyerInfo, onChange }: BuyerFormProps) {
  const updateField = (field: keyof BuyerInfo, value: string | number | null) => {
    onChange({ ...buyerInfo, [field]: value });
  };

  const handleMapPinChange = (lat: number, lng: number) => {
    onChange({ ...buyerInfo, delivery_lat: lat, delivery_lng: lng });
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

      {/* Delivery Address + Map (combined) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          Delivery Address
        </Label>
        <p className="text-xs text-muted-foreground">
          Type your address and tap <span className="font-medium">Find</span>, or drop a pin directly on the map.
        </p>
        <MapPinSelector
          lat={buyerInfo.delivery_lat}
          lng={buyerInfo.delivery_lng}
          onChange={handleMapPinChange}
          address={buyerInfo.delivery_address}
          onAddressChange={(address) => updateField('delivery_address', address)}
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
