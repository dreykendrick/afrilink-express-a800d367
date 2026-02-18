import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Order } from '@/lib/types';

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          product:products(
            id,
            name,
            slug,
            price,
            images
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching order:', error);
        throw new Error('Order not found');
      }

      if (!data) {
        throw new Error('Order not found');
      }

      return data as unknown as Order;
    },
    enabled: !!orderId,
    refetchInterval: 5000,
  });
}

export function useOrderByToken(orderId: string, token: string) {
  return useQuery({
    queryKey: ['order', orderId, 'token', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          product:products(
            id,
            name,
            slug,
            price,
            images
          )
        `)
        .eq('id', orderId)
        .eq('confirmation_token', token)
        .maybeSingle();

      if (error) {
        console.error('Error fetching order:', error);
        throw new Error('Order not found');
      }

      if (!data) {
        throw new Error('Invalid confirmation link');
      }

      return data as unknown as Order;
    },
    enabled: !!orderId && !!token,
  });
}
