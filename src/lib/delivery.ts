/**
 * Delivery estimation utilities — Haversine distance + admin-configured pricing.
 */
import type { DeliverySettings, DeliveryEstimate } from '@/lib/types';

const EARTH_RADIUS_KM = 6371;

/** Default fallback when no delivery_settings row exists */
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  enabled: true,
  base_fee: 1500,
  price_per_km: 500,
  minimum_fee: 1500,
  maximum_fee: null,
  free_delivery_threshold: null,
  max_delivery_distance_km: null,
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance between two lat/lng points in km */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Calculate delivery fee from distance and admin settings */
export function calculateDeliveryEstimate(
  vendorLat: number | null,
  vendorLng: number | null,
  buyerLat: number | null,
  buyerLng: number | null,
  settings: DeliverySettings,
  subtotal: number = 0,
): DeliveryEstimate {
  if (import.meta.env.DEV) {
    console.log('[DEBUG] calculateDeliveryEstimate inputs:', {
      vendorLat, vendorLng, buyerLat, buyerLng,
      settings, subtotal,
    });
  }
  if (!settings.enabled) {
    return { distance_km: 0, delivery_fee: 0, is_within_range: true };
  }

  // Vendor location must be configured
  if (vendorLat == null || vendorLng == null) {
    return {
      distance_km: 0,
      delivery_fee: 0,
      is_within_range: false,
      error_message: 'Vendor location is not configured yet.',
    };
  }

  // Can't calculate without buyer coordinates
  if (buyerLat == null || buyerLng == null) {
    return { distance_km: 0, delivery_fee: settings.minimum_fee, is_within_range: true };
  }

  const distance_km = Math.round(haversineDistance(vendorLat, vendorLng, buyerLat, buyerLng) * 10) / 10;

  // Check max distance
  if (settings.max_delivery_distance_km != null && distance_km > settings.max_delivery_distance_km) {
    return {
      distance_km,
      delivery_fee: 0,
      is_within_range: false,
      error_message: `Delivery is not available beyond ${settings.max_delivery_distance_km} km. Your location is ${distance_km} km away.`,
    };
  }

  // Free delivery threshold
  if (settings.free_delivery_threshold != null && subtotal >= settings.free_delivery_threshold) {
    return { distance_km, delivery_fee: 0, is_within_range: true };
  }

  // Calculate fee
  let fee = settings.base_fee + distance_km * settings.price_per_km;
  fee = Math.max(fee, settings.minimum_fee);
  if (settings.maximum_fee != null) {
    fee = Math.min(fee, settings.maximum_fee);
  }
  // Round to nearest 100
  fee = Math.round(fee / 100) * 100;

  return { distance_km, delivery_fee: fee, is_within_range: true };
}
