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

export async function fetchProduct(idOrSlug: string): Promise<Product> {
  const raw = await apiFetch<any>(`/products/${encodeURIComponent(idOrSlug)}`);
  // The main backend may wrap in { success, product } or return flat
  const p = raw?.product ?? raw;
  return normalizeProduct(p);
}

/** Map main-backend field names to our frontend Product type */
function normalizeProduct(p: any): Product {
  return {
    id: p.id,
    vendor_id: p.vendor_id ?? '',
    slug: p.slug ?? '',
    name: p.title ?? p.name ?? '',
    price: p.price ?? 0,
    description: p.description ?? null,
    short_description: p.short_description ?? null,
    images: p.image_urls ?? p.images ?? (p.image_url ? [p.image_url] : []),
    is_active: true,
    created_at: p.created_at ?? '',
    updated_at: p.updated_at ?? '',
  };
}

// ---- Delivery Fees / Cities ----

export function fetchDeliveryFees(): Promise<any> {
  return apiFetch<any>('/delivery-fees');
}

export async function fetchCities(): Promise<Array<{ id: string; name: string }>> {
  const payload = await fetchDeliveryFees();

  const directCities = Array.isArray(payload?.cities) ? payload.cities : [];
  const zoneCities = Array.isArray(payload?.zones) ? payload.zones : [];

  const normalized = [
    ...directCities.map((c: any) => ({ id: c.id ?? c.city_id ?? c.cityId, name: c.name ?? c.city_name ?? c.city })),
    ...zoneCities.map((z: any) => ({ id: z.city_id ?? z.cityId ?? z.id, name: z.city_name ?? z.city ?? z.name })),
  ].filter((c) => c.id && c.name) as Array<{ id: string; name: string }>;

  const unique = new Map<string, { id: string; name: string }>();
  normalized.forEach((city) => unique.set(city.id, city));

  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
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

// ---- Report Issue ----

export async function reportOrderIssue(orderId: string, reason: string, notes?: string | null): Promise<void> {
  await apiFetch('/report-issue', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, reason, notes: notes || null }),
  });
}
