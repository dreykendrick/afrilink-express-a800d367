/**
 * API helpers – product/affiliate data comes from the main backend,
 * while checkout/delivery/orders use this project's own checkout-api.
 */

const EXTERNAL_API_BASE = 'https://ckklirhhwndijsjpmnfe.supabase.co/functions/v1';
const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2xpcmhod25kaWpzanBtbmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzNDUzMDksImV4cCI6MjA2MTkyMTMwOX0.aNJkJVXNqzBicShLsFbIbYUS0bQHNBMxdbwcjJOavLM';

const LOCAL_API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const LOCAL_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Fetch from the external (main) backend */
async function externalFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${EXTERNAL_API_BASE}/checkout-api${path}`, {
    ...options,
    headers: {
      'apikey': EXTERNAL_ANON_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (res.status === 404) throw new Error('Not found');
  if (!res.ok) {
    const text = await res.text();
    console.error(`External API error ${res.status}:`, text);
    throw new Error(res.status === 403 ? 'Permission denied' : 'Request failed');
  }

  return res.json();
}

/** Fetch from this project's own checkout-api */
async function localFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${LOCAL_API_BASE}/checkout-api${path}`, {
    ...options,
    headers: {
      'apikey': LOCAL_ANON_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (res.status === 404) throw new Error('Not found');
  if (!res.ok) {
    let errorMessage = 'Request failed';
    try {
      const body = await res.json();
      errorMessage = body?.error || errorMessage;
    } catch {
      // ignore parse errors
    }
    console.error(`Local API error ${res.status}:`, errorMessage);
    throw new Error(errorMessage);
  }

  return res.json();
}

// ---- Product ----

import type { Product, Order, CheckoutPayload, CheckoutResult, DeliverySettings } from '@/lib/types';
import { DEFAULT_DELIVERY_SETTINGS } from '@/lib/delivery';

export async function fetchProduct(idOrSlug: string): Promise<Product> {
  const raw = await localFetch<any>(`/products/${encodeURIComponent(idOrSlug)}`);
  const p = raw?.product ?? raw;
  return normalizeProduct(p);
}

/** Map main-backend field names to our frontend Product type */
function normalizeProduct(p: any): Product {
  const v = p.vendor ?? {};
  const vendor_lat = p.vendor_lat ?? v.lat ?? v.vendor_lat ?? null;
  const vendor_lng = p.vendor_lng ?? v.lng ?? v.vendor_lng ?? null;
  const vendor_address = p.vendor_address ?? v.address ?? v.vendor_address ?? null;

  const parsedLat = vendor_lat != null ? Number(vendor_lat) : null;
  const parsedLng = vendor_lng != null ? Number(vendor_lng) : null;
  const validLat = parsedLat != null && !isNaN(parsedLat) ? parsedLat : null;
  const validLng = parsedLng != null && !isNaN(parsedLng) ? parsedLng : null;

  return {
    id: p.id,
    vendor_id: p.vendor_id ?? '',
    vendor_lat: validLat,
    vendor_lng: validLng,
    vendor_address,
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

// ---- Delivery Settings ----

export async function fetchDeliverySettings(): Promise<DeliverySettings> {
  try {
    const url = `${LOCAL_API_BASE}/checkout-api/delivery-settings`;
    const res = await fetch(url, {
      headers: {
        'apikey': LOCAL_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Failed to load delivery settings: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[WARN] Using default delivery settings (fetch failed):', err);
    return DEFAULT_DELIVERY_SETTINGS;
  }
}

// ---- Affiliate ----

interface AffiliateInfo {
  id: string;
  code: string;
  name: string;
  commission_rate: number;
}

export function fetchAffiliate(code: string): Promise<AffiliateInfo | null> {
  return externalFetch<AffiliateInfo>(`/affiliates/${encodeURIComponent(code)}`).catch(() => null);
}

export async function trackAffiliateClick(
  affiliateCode: string,
  productId: string,
  sessionId: string,
): Promise<void> {
  await localFetch('/track-click', {
    method: 'POST',
    body: JSON.stringify({ affiliate_code: affiliateCode, product_id: productId, session_id: sessionId }),
  }).catch((err) => console.error('Click tracking failed:', err));
}

// ---- Unified Checkout ----

export async function createCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  return localFetch<CheckoutResult>('/checkout/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function confirmCheckoutPayment(orderId: string): Promise<Order> {
  return localFetch<Order>('/checkout/confirm', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
  });
}

// ---- Receipt ----

export function fetchReceipt(orderId: string): Promise<Order> {
  return localFetch<Order>(`/receipt/${encodeURIComponent(orderId)}`);
}

// ---- Confirm Delivery ----

export async function confirmDelivery(orderId: string, token: string): Promise<Order> {
  return localFetch<Order>('/confirm-delivery', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, token }),
  });
}

// ---- Report Issue ----

export async function reportOrderIssue(orderId: string, reason: string, notes?: string | null): Promise<void> {
  await localFetch('/report-issue', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, reason, notes: notes || null }),
  });
}
