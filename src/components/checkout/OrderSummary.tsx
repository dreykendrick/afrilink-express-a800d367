import { formatPrice } from '@/lib/format';

interface OrderSummaryProps {
  itemPrice: number;
  deliveryFee: number;
  totalAmount: number;
}

export function OrderSummary({ itemPrice, deliveryFee, totalAmount }: OrderSummaryProps) {
  return (
    <div className="card-premium p-4 space-y-3">
      <h3 className="font-semibold">Order Summary</h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Item price</span>
          <span>{formatPrice(itemPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Delivery</span>
          <span>{deliveryFee > 0 ? formatPrice(deliveryFee) : '—'}</span>
        </div>
        <div className="border-t border-border pt-2 flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span className="text-primary">{formatPrice(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
