import { formatPrice, formatDate, formatPhoneDisplay } from '@/lib/format';
import type { Order } from '@/lib/types';

interface ReceiptDetailsProps {
  order: Order;
}

export function ReceiptDetails({ order }: ReceiptDetailsProps) {
  const product = order.product;

  return (
    <div className="space-y-4">
      {/* Product */}
      <div className="card-premium p-4">
        <h3 className="font-semibold mb-3">Product</h3>
        <div className="flex items-center gap-3">
          {product?.images?.[0] && (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-16 h-16 rounded-lg object-cover bg-secondary"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{product?.name}</p>
            <p className="text-primary font-semibold">{formatPrice(order.item_price)}</p>
          </div>
        </div>
      </div>

      {/* Delivery Address */}
      <div className="card-premium p-4">
        <h3 className="font-semibold mb-3">Delivery Address</h3>
        <div className="text-sm space-y-1 text-muted-foreground">
          <p className="text-foreground font-medium">{order.buyer_name}</p>
          <p>{formatPhoneDisplay(order.buyer_phone)}</p>
          <p>{order.delivery_address || order.buyer_area}</p>
          {order.buyer_landmark && <p>{order.buyer_landmark}</p>}
          {order.distance_km != null && order.distance_km > 0 && (
            <p className="text-xs">Est. distance: {order.distance_km} km</p>
          )}
        </div>
      </div>

      {/* Payment Summary */}
      <div className="card-premium p-4">
        <h3 className="font-semibold mb-3">Payment Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Item price</span>
            <span>{formatPrice(order.item_price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery fee</span>
            <span>{order.delivery_fee > 0 ? formatPrice(order.delivery_fee) : '—'}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between font-semibold">
            <span>Total paid</span>
            <span className="text-primary">{formatPrice(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Order Info */}
      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>Order placed on {formatDate(order.created_at)}</p>
      </div>
    </div>
  );
}
