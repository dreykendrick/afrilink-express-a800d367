import { useQuery } from '@tanstack/react-query';
import { fetchReceipt } from '@/lib/api';
import type { Order } from '@/lib/types';

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: (): Promise<Order> => fetchReceipt(orderId),
    enabled: !!orderId,
    refetchInterval: 5000,
  });
}

export function useOrderByToken(orderId: string, token: string) {
  return useQuery({
    queryKey: ['order', orderId, 'token', token],
    queryFn: (): Promise<Order> => fetchReceipt(orderId),
    enabled: !!orderId && !!token,
  });
}
