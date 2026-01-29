import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/lib/types';

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendor:vendors(
            id,
            name,
            city_id,
            city:cities(id, name)
          )
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching product:', error);
        throw new Error('Product not found');
      }

      if (!data) {
        throw new Error('Product not found');
      }

      return data as unknown as Product;
    },
    enabled: !!slug,
    retry: 1,
  });
}
