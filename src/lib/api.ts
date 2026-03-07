/**
 * API helpers – checkout data fetching goes through the main app's checkout-api edge function.
 * Delivery settings are fetched from this project's own checkout-api.
 */

const API_BASE = 'https://ckklirhhwndijsjpmnfe.supabase.co/functions/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2xpcmhod25kaWpzanBtbmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzNDUzMDksImV4cCI6MjA2MTkyMTMwOX0.aNJkJVXNqzBicShLsFbIbYUS0bQHNBMxdbwcjJOavLM';

const LOCAL_API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const LOCAL_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
  return {
    id: p.id,
    vendor_id: p.vendor_id ?? '',
    vendor_lat: p.vendor_lat ?? null,
    vendor_lng: p.vendor_lng ?? null,
    vendor_address: p.vendor_address ?? null,
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
    const res = await fetch(`${LOCAL_API_BASE}/checkout-api/delivery-settings`, {
      headers: {
        'apikey': LOCAL_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error('Failed to load delivery settings');
    return res.json();
  } catch (err) {
    console.warn('Using default delivery settings:', err);
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
