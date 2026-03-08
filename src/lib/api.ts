/**
 * API helpers – checkout data fetching goes through the main app's checkout-api edge function.
 * Delivery settings are fetched from this project's own checkout-api.
 */

const API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

import type { Product, Order, CheckoutPayload, CheckoutResult, DeliverySettings } from '@/lib/types';
import { DEFAULT_DELIVERY_SETTINGS } from '@/lib/delivery';

export async function fetchProduct(idOrSlug: string): Promise<Product> {
  const raw = await apiFetch<any>(`/products/${encodeURIComponent(idOrSlug)}`);
  const p = raw?.product ?? raw;
  return normalizeProduct(p);
}

/** Map main-backend field names to our frontend Product type */
function normalizeProduct(p: any): Product {
  // Support multiple possible vendor location structures:
  // 1. Flat: p.vendor_lat / p.vendor_lng / p.vendor_address
  // 2. Nested object: p.vendor.lat / p.vendor.lng / p.vendor.address
  // 3. Nested with prefix: p.vendor.vendor_lat / p.vendor.vendor_lng
  const v = p.vendor ?? {};
  const vendor_lat = p.vendor_lat ?? v.lat ?? v.vendor_lat ?? null;
  const vendor_lng = p.vendor_lng ?? v.lng ?? v.vendor_lng ?? null;
  const vendor_address = p.vendor_address ?? v.address ?? v.vendor_address ?? null;

  // Coerce to number if string coordinates come through
  const parsedLat = vendor_lat != null ? Number(vendor_lat) : null;
  const parsedLng = vendor_lng != null ? Number(vendor_lng) : null;
  const validLat = parsedLat != null && !isNaN(parsedLat) ? parsedLat : null;
  const validLng = parsedLng != null && !isNaN(parsedLng) ? parsedLng : null;

  if (import.meta.env.DEV) {
    console.log('[DEBUG] normalizeProduct vendor location:', {
      raw_vendor_lat: p.vendor_lat,
      raw_vendor_lng: p.vendor_lng,
      nested_vendor: p.vendor,
      resolved: { vendor_lat: validLat, vendor_lng: validLng, vendor_address },
    });
  }

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
    if (import.meta.env.DEV) {
      console.log('[DEBUG] Fetching delivery settings from:', url);
    }
    const res = await fetch(url, {
      headers: {
        'apikey': LOCAL_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Failed to load delivery settings: ${res.status}`);
    const settings = await res.json();
    if (import.meta.env.DEV) {
      console.log('[DEBUG] Delivery settings loaded from DB:', settings);
    }
    return settings;
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

// ---- Unified Checkout ----

export async function createCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  return apiFetch<CheckoutResult>('/checkout/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function confirmCheckoutPayment(orderId: string): Promise<Order> {
  return apiFetch<Order>('/checkout/confirm', {
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
