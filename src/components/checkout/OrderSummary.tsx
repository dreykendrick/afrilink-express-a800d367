import { formatPrice } from '@/lib/format';
import { AlertTriangle, Truck } from 'lucide-react';

interface OrderSummaryProps {
  itemPrice: number;
  deliveryFee: number;
  totalAmount: number;
  distanceKm: number | null;
  isWithinRange: boolean;
  rangeErrorMessage?: string;
}

export function OrderSummary({
  itemPrice,
  deliveryFee,
  totalAmount,
  distanceKm,
  isWithinRange,
  rangeErrorMessage,
}: OrderSummaryProps) {
  return (
    <div className="card-premium p-4 space-y-3">
      <h3 className="font-semibold">Order Summary</h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Item price</span>
          <span>{formatPrice(itemPrice)}</span>
        </div>

        {distanceKm != null && distanceKm > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              Est. distance
            </span>
            <span>{distanceKm} km</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">Delivery</span>
          <span>{deliveryFee > 0 ? formatPrice(deliveryFee) : '—'}</span>
        </div>

        <div className="border-t border-border pt-2 flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span className="text-primary">{formatPrice(totalAmount)}</span>
        </div>
      </div>

      {!isWithinRange && rangeErrorMessage && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{rangeErrorMessage}</p>
        </div>
      )}
    </div>
  );
}
