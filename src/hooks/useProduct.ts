import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/lib/types';

/**
 * Fetch a product by slug directly from the database.
 */
export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        console.error('Error fetching product by slug:', error);
        throw new Error('Product not found');
      }
      if (!data) throw new Error('Product not found');

      return data as unknown as Product;
    },
    enabled: !!slug,
    retry: 1,
  });
}
