import { User, Phone, MapPin, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BuyerInfo, City } from '@/lib/types';

interface BuyerFormProps {
  buyerInfo: BuyerInfo;
  onChange: (info: BuyerInfo) => void;
  cities: City[];
}

export function BuyerForm({ buyerInfo, onChange, cities }: BuyerFormProps) {
  const updateField = (field: keyof BuyerInfo, value: string) => {
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

      {/* City */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          City
        </Label>
        <Select
          value={buyerInfo.cityId}
          onValueChange={(value) => updateField('cityId', value)}
        >
          <SelectTrigger className="h-12 bg-secondary border-0">
            <SelectValue placeholder="Select your city" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {cities.map((city) => (
              <SelectItem key={city.id} value={city.id}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
