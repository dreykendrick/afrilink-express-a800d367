/**
 * Canonical URL configuration for AfriLink
 * 
 * Uses NEXT_PUBLIC_APP_URL or VITE_APP_URL for production domain,
 * falling back to window.location.origin for development/preview.
 */

// Get the canonical app URL - single source of truth
export function getAppUrl(): string {
  // Check for environment variables (Vite uses import.meta.env)
  const envUrl = import.meta.env.VITE_APP_URL || 
                 import.meta.env.NEXT_PUBLIC_APP_URL;
  
  if (envUrl) {
    // Remove trailing slash if present
    return envUrl.replace(/\/$/, '');
  }
  
  // Fallback to current origin for dev/preview
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  return 'https://shop.afrilink.info';
}

// Build a product URL with optional affiliate ref (uses slug)
export function getProductUrl(slug: string, ref?: string | null): string {
  const baseUrl = `${getAppUrl()}/p/${slug}`;
  if (ref) {
    return `${baseUrl}?ref=${encodeURIComponent(ref)}`;
  }
  return baseUrl;
}

// Build a checkout URL with optional affiliate ref
export function getCheckoutUrl(productId: string, ref?: string | null): string {
  const baseUrl = `${getAppUrl()}/checkout/${productId}`;
  if (ref) {
    return `${baseUrl}?ref=${encodeURIComponent(ref)}`;
  }
  return baseUrl;
}

// Build an order confirmation URL
export function getConfirmationUrl(orderId: string, token: string): string {
  return `${getAppUrl()}/confirm/${orderId}?token=${encodeURIComponent(token)}`;
}

// Build a receipt URL
export function getReceiptUrl(orderId: string): string {
  return `${getAppUrl()}/receipt/${orderId}`;
}

// Check if current URL is on a preview/dev domain
export function isPreviewDomain(): boolean {
  if (typeof window === 'undefined') return false;
  
  const host = window.location.host;
  return host.includes('lovable.app') || 
         host.includes('lovableproject.com') ||
         host.includes('localhost');
}

// Get the canonical URL for the current page (useful for SEO)
export function getCanonicalUrl(path?: string): string {
  const appUrl = getAppUrl();
  if (path) {
    return `${appUrl}${path.startsWith('/') ? path : '/' + path}`;
  }
  if (typeof window !== 'undefined') {
    return `${appUrl}${window.location.pathname}${window.location.search}`;
  }
  return appUrl;
}
