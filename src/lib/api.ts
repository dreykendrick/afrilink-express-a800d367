import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_DELIVERY_SETTINGS } from '@/lib/delivery';
import type { Product, Order, CheckoutPayload, CheckoutResult, DeliverySettings } from '@/lib/types';

const HARDCODED_URL = 'https://dqclmqbegnimtbkndrif.supabase.co';
const HARDCODED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxY2xtcWJlZ25pbXRia25kcmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NjE4NzMsImV4cCI6MjEwMTUzNzg3M30.pemKTzkeYqSOtiVGwCWx5uzXyITJLnCCVVBacPGvalo';

// This storefront is intentionally coupled to the shared Winger Supabase project.
// Do not allow stale Vercel variables to mix a legacy URL/key with this backend.
const SUPABASE_URL = HARDCODED_URL;
const LOCAL_ANON_KEY = HARDCODED_KEY;
const LOCAL_API_BASE = `${SUPABASE_URL}/functions/v1`;

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

export async function fetchProduct(idOrSlug: string): Promise<Product> {
  const decoded = decodeURIComponent(idOrSlug).trim();
  const normalizedSlug = decoded.replace(/\s+/g, '-');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded);

  const queryUrl = new URL(`${SUPABASE_URL}/rest/v1/products`);
  queryUrl.searchParams.set('select', '*');
  if (isUuid) {
    queryUrl.searchParams.set('or', `(id.eq.${decoded},slug.eq.${decoded},slug.eq.${normalizedSlug})`);
  } else {
    queryUrl.searchParams.set('or', `(slug.eq.${decoded},slug.eq.${normalizedSlug})`);
  }
  queryUrl.searchParams.set('status', 'eq.approved');
  queryUrl.searchParams.set('is_available', 'eq.true');
  queryUrl.searchParams.set('limit', '1');

  try {
    const res = await fetch(queryUrl.toString(), {
      headers: {
        'apikey': LOCAL_ANON_KEY,
        'Authorization': `Bearer ${LOCAL_ANON_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return normalizeProduct(rows[0]);
      }
    }
  } catch (err) {
    console.warn('Direct DB query failed, trying edge function:', err);
  }

  // Fallback: try edge function
  try {
    const raw = await localFetch<any>(`/products/${encodeURIComponent(normalizedSlug)}`);
    const p = raw?.product ?? raw;
    if (p && (p.id || p.title || p.name)) {
      return normalizeProduct(p);
    }
  } catch (err) {
    console.warn('checkout-api endpoint also failed:', err);
  }

  throw new Error('Product not found');
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

export async function fetchAffiliate(code: string): Promise<AffiliateInfo | null> {
  try {
    const { data } = await supabase
      .from('affiliate_links')
      .select('id, code')
      .eq('code', code)
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        code: data.code || code,
        name: 'Affiliate Partner',
        commission_rate: 10,
      };
    }
  } catch (err) {
    console.warn('fetchAffiliate DB query notice:', err);
  }
  return null;
}

export async function trackAffiliateClick(
  affiliateCode: string,
  productId: string,
  sessionId: string,
): Promise<void> {
  try {
    await (supabase as any).rpc('resolve_affiliate_link', { p_code: affiliateCode });
  } catch (err) {
    console.warn('Click tracking notice:', err);
  }
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
