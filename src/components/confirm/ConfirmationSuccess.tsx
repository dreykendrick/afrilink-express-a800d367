import { CheckCircle2 } from 'lucide-react';
import { formatPrice, formatDate } from '@/lib/format';
import type { Order } from '@/lib/types';

interface ConfirmationSuccessProps {
  order: Order;
}

export function ConfirmationSuccess({ order }: ConfirmationSuccessProps) {
  const firstItem = order.order_items?.[0];
  const product = firstItem?.product;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-success" />
      </div>

      <h1 className="text-2xl font-bold mb-2">Delivery Confirmed!</h1>
      <p className="text-muted-foreground max-w-xs">
        Thank you for confirming. Your payment has been released to the vendor.
      </p>

      <div className="card-premium p-4 mt-8 w-full max-w-sm text-left">
        <div className="flex items-center gap-3 mb-4">
          {(product?.image_urls?.[0] || product?.image_url) && (
            <img
              src={product.image_urls?.[0] || product.image_url!}
              alt={product.title}
              className="w-14 h-14 rounded-lg object-cover bg-secondary"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{product?.title}</p>
            <p className="text-primary font-semibold text-sm">
              {formatPrice(order.total_amount)}
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
          <p>Order #{order.id.slice(0, 8).toUpperCase()}</p>
          {order.updated_at && (
            <p>Confirmed on {formatDate(order.updated_at)}</p>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-8">
        Have questions?{' '}
        <a href="#" className="text-primary hover:underline">
          Contact support
        </a>
      </p>
    </div>
  );
}
