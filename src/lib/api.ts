/**
 * API helpers – all checkout data fetching goes through the checkout-api edge function.
 */

const CHECKOUT_SUPABASE_URL = 'https://ckklirhhwndijsjpmnfe.supabase.co';
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const BASE = `${CHECKOUT_SUPABASE_URL}/functions/v1/checkout-api`;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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

import type { Product } from '@/lib/types';

export function fetchProduct(idOrSlug: string): Promise<Product> {
  return apiFetch<Product>(`/products/${encodeURIComponent(idOrSlug)}`);
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
  affiliateId: string,
  productId: string,
  sessionId: string,
): Promise<void> {
  await apiFetch('/affiliate-clicks', {
    method: 'POST',
    body: JSON.stringify({ affiliate_id: affiliateId, product_id: productId, session_id: sessionId }),
  }).catch((err) => console.error('Click tracking failed:', err));
}
