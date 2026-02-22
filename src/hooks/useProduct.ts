import { useQuery } from '@tanstack/react-query';
import { fetchProduct } from '@/lib/api';
import type { Product } from '@/lib/types';

/**
 * Fetch a product by ID (UUID) or slug via the checkout-api edge function.
 */
export function useProduct(identifier: string) {
  return useQuery({
    queryKey: ['product', identifier],
    queryFn: (): Promise<Product> => fetchProduct(identifier),
    enabled: !!identifier,
    retry: 1,
  });
}
