import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/lib/types';

// UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetch a product by identifier (ID or slug).
 * Tries ID lookup first if the identifier looks like a UUID,
 * otherwise falls back to slug matching (exact, then base-slug).
 */
export function useProduct(identifier: string) {
  return useQuery({
    queryKey: ['product', identifier],
    queryFn: async () => {
      // If it looks like a UUID, try ID lookup first
      if (UUID_RE.test(identifier)) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();

        if (error) {
          console.error('Error fetching product by id:', error);
          throw new Error('Product not found');
        }
        if (data) return data as unknown as Product;
      }

      // Try exact slug match
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', identifier)
        .maybeSingle();

      if (error) {
        console.error('Error fetching product by slug:', error);
        throw new Error('Product not found');
      }
      if (data) return data as unknown as Product;

      // Fallback: strip trailing hex suffix and retry slug
      const baseSlug = identifier.replace(/-[a-z0-9]{4,8}$/i, '');
      if (baseSlug && baseSlug !== identifier) {
        const { data: fallback } = await supabase
          .from('products')
          .select('*')
          .eq('slug', baseSlug)
          .maybeSingle();

        if (fallback) return fallback as unknown as Product;
      }

      throw new Error('Product not found');
    },
    enabled: !!identifier,
    retry: 1,
  });
}
