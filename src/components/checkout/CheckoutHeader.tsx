import { ChevronLeft } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import type { Product } from '@/lib/types';

interface CheckoutHeaderProps {
  product: Product;
  onBack: () => void;
}

export function CheckoutHeader({ product, onBack }: CheckoutHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
      {/* Back Button */}
      <div className="p-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
      </div>

      {/* Product Summary */}
      <div className="flex items-center gap-3 px-4 pb-4">
        {product.images?.[0] && (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-16 h-16 rounded-lg object-cover bg-secondary"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-medium text-sm truncate">{product.name}</h1>
          <p className="text-primary font-semibold">{formatPrice(product.price)}</p>
        </div>
      </div>
    </div>
  );
}
