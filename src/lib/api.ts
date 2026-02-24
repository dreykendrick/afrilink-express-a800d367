/**
 * API helpers – all checkout data fetching goes through the main app's checkout-api edge function.
 */

const API_BASE = 'https://ckklirhhwndijsjpmnfe.supabase.co/functions/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2xpcmhod25kaWpzanBtbmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxOTUsImV4cCI6MjA4NTE3OTE5NX0.Z_RwkN3M8q2exVSUUULJBllHB0WXBWpODQcG1-xHaDU';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/checkout-api${path}`, {
    ...options,
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (res.status === 404) throw new Error('Not found');
  if (!res.ok) {
    const text = await res.text();
    console.error(`API error ${res.status}:`, text);
    throw new Error(res.status === 403 ? 'Permission denied' : 'Request failed');
  }

  return res.json();
}

// ---- Product ----

import type { Product, Order } from '@/lib/types';

export function fetchProduct(idOrSlug: string): Promise<Product> {
  return apiFetch<Product>(`/products/${encodeURIComponent(idOrSlug)}`);
}

// ---- Delivery Fees ----

export function fetchDeliveryFees(): Promise<any> {
  return apiFetch<any>('/delivery-fees');
}

// ---- Affiliate ----

interface AffiliateInfo {
  id: string;
  code: string;
  name: string;
  commission_rate: number;
}

export function fetchAffiliate(code: string): Promise<AffiliateInfo | null> {
  return apiFetch<AffiliateInfo>(`/affiliates/${encodeURIComponent(code)}`).catch(() => null);
}

export async function trackAffiliateClick(
  affiliateCode: string,
  productId: string,
  sessionId: string,
): Promise<void> {
  await apiFetch('/track-click', {
    method: 'POST',
    body: JSON.stringify({ affiliate_code: affiliateCode, product_id: productId, session_id: sessionId }),
  }).catch((err) => console.error('Click tracking failed:', err));
}

// ---- Orders ----

export interface CreateOrderPayload {
  product_id: string;
  customer_name: string;
  customer_phone: string;
  customer_city_id: string;
  customer_area: string;
  customer_landmark?: string;
  customer_notes?: string;
  affiliate_code?: string;
  checkout_session_id: string;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  return apiFetch<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function confirmPayment(orderId: string): Promise<Order> {
  return apiFetch<Order>('/confirm-payment', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
  });
}

// ---- Receipt ----

export function fetchReceipt(orderId: string): Promise<Order> {
  return apiFetch<Order>(`/receipt/${encodeURIComponent(orderId)}`);
}

// ---- Confirm Delivery ----

export async function confirmDelivery(orderId: string, token: string): Promise<Order> {
  return apiFetch<Order>('/confirm-delivery', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, token }),
  });
}
