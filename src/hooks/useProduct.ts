import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/lib/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetch a product by ID (UUID) or slug.
 * Falls back to a server-side endpoint if RLS blocks the client query.
 */
export function useProduct(identifier: string) {
  return useQuery({
    queryKey: ['product', identifier],
    queryFn: async (): Promise<Product> => {
      // 1. Try direct Supabase query (respects RLS)
      const isUUID = UUID_REGEX.test(identifier);
      const column = isUUID ? 'id' : 'slug';

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq(column, identifier)
        .maybeSingle();

      if (data) return data as unknown as Product;

      // If RLS denied access (permission error), try server-side fallback
      if (error) {
        const code = error.code ?? '';
        const isPermission = code === '42501' || error.message?.includes('permission');

        if (isPermission) {
          console.warn('RLS blocked product query, trying server fallback:', error.message);
          return fetchProductFromEdge(identifier);
        }

        console.error('Error fetching product:', error);
        throw new Error('Product not found');
      }

      // No data, no error → not found
      throw new Error('Product not found');
    },
    enabled: !!identifier,
    retry: 1,
  });
}

/**
 * Server-side fallback: fetches product via edge function using service role.
 */
async function fetchProductFromEdge(identifier: string): Promise<Product> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/get-product?identifier=${encodeURIComponent(identifier)}`,
    {
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
    }
  );

  if (res.status === 404) {
    throw new Error('Product not found');
  }

  if (res.status === 403 || res.status === 401) {
    console.error('Permission denied fetching product from edge function');
    throw new Error('Unable to load product (permission)');
  }

  if (!res.ok) {
    const text = await res.text();
    console.error('Edge function error:', text);
    throw new Error('Product not found');
  }

  return res.json();
}
