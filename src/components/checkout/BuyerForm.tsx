import { useEffect, useState } from 'react';
import { User, Phone, MapPin, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchCities } from '@/lib/api';
import type { BuyerInfo } from '@/lib/types';

interface BuyerFormProps {
  buyerInfo: BuyerInfo;
  onChange: (info: BuyerInfo) => void;
}

export function BuyerForm({ buyerInfo, onChange }: BuyerFormProps) {
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchCities()
      .then((data) => setCities(data))
      .catch((err) => console.error('Failed to load cities:', err));
  }, []);

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
