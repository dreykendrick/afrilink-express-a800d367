import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import type { Product } from '@/lib/types';

interface ProductDetailsProps {
  product: Product;
}

export function ProductDetails({ product }: ProductDetailsProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);

  const description = product.description || product.short_description;
  const hasLongDescription = description && description.length > 150;

  return (
    <div className="p-4 space-y-4">
      {/* Price & Name */}
      <div className="space-y-1">
        <p className="text-2xl font-bold text-primary">
          {formatPrice(product.price)}
        </p>
        <h1 className="text-xl font-semibold leading-tight">{product.name}</h1>
      </div>

      {/* Short Description */}
      {product.short_description && !product.description && (
        <p className="text-muted-foreground leading-relaxed">
          {product.short_description}
        </p>
      )}

      {/* Full Description (expandable) */}
      {product.description && (
        <div className="border-t border-border pt-4">
          <p
            className={`text-sm text-muted-foreground leading-relaxed ${
              !showFullDescription && hasLongDescription ? 'line-clamp-3' : ''
            }`}
          >
            {product.description}
          </p>
          {hasLongDescription && (
            <button
              onClick={() => setShowFullDescription(!showFullDescription)}
              className="flex items-center gap-1 text-sm text-primary mt-2 font-medium"
            >
              {showFullDescription ? (
                <>
                  Show less <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Read more <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
