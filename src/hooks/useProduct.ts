import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/lib/types';

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      // Try exact match first
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        console.error('Error fetching product:', error);
        throw new Error('Product not found');
      }

      if (data) {
        return data as unknown as Product;
      }

      // Fallback: try matching the base slug (before any suffix like "-bd6d5c")
      const baseSlug = slug.replace(/-[a-z0-9]{4,8}$/i, '');
      if (baseSlug && baseSlug !== slug) {
        const { data: fallback } = await supabase
          .from('products')
          .select('*')
          .eq('slug', baseSlug)
          .maybeSingle();

        if (fallback) {
          return fallback as unknown as Product;
        }
      }

      throw new Error('Product not found');
    },
    enabled: !!slug,
    retry: 1,
  });
}
