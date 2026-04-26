// AfriLink Checkout Types

export interface Product {
  id: string;
  vendor_id: string;
  vendor_lat: number | null;
  vendor_lng: number | null;
  vendor_address: string | null;
  slug: string;
  name: string;
  price: number;
  description: string | null;
  short_description: string | null;
  images: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliverySettings {
  enabled: boolean;
  base_fee: number;
  price_per_km: number;
  minimum_fee: number;
  maximum_fee: number | null;
  free_delivery_threshold: number | null;
  max_delivery_distance_km: number | null;
}

export interface DeliveryEstimate {
  distance_km: number;
  delivery_fee: number;
  is_within_range: boolean;
  error_message?: string;
}

export interface BuyerInfo {
  name: string;
  phone: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  landmark: string;
  notes: string;
}

export type PaymentStatus = 'pending_payment' | 'paid' | 'confirmed' | 'failed' | 'refunded';
export type CheckoutSource = 'affiliate_link' | 'marketplace';
export type BuyerRole = 'guest' | 'customer' | 'vendor' | 'affiliate';

export interface CheckoutPayload {
  product_id: string;
  quantity?: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  customer_landmark?: string;
  customer_notes?: string;
  source: CheckoutSource;
  buyer_user_id?: string | null;
  buyer_role: BuyerRole;
  affiliate_ref?: string | null;
  checkout_session_id: string;
}

export interface CheckoutResult {
  order_id: string;
  order_number: string;
  subtotal: number;
  distance_km: number;
  delivery_fee: number;
  total: number;
  payment_url?: string;
  client_secret?: string;
}

export interface Order {
  id: string;
  order_number: string;
  product_id: string;
  affiliate_id: string | null;
  buyer_name: string;
  buyer_phone: string;
  buyer_area: string;
  buyer_landmark: string | null;
  buyer_notes: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  distance_km: number | null;
  item_price: number;
  delivery_fee: number;
  total_amount: number;
  order_status: string;
  payment_status: string;
  notification_status: string | null;
  confirmation_token: string;
  vendor_notified_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  source: CheckoutSource | null;
  buyer_user_id: string | null;
  buyer_role: BuyerRole | null;
  affiliate_rate_at_purchase: number | null;
  // External Order Service (order-guardian)
  external_order_id?: string | null;
  tracking_token?: string | null;
  tracking_url?: string | null;
  external_forwarded_at?: string | null;
  // Joined
  product?: Product;
}

export interface OrderIssue {
  id: string;
  order_id: string;
  reason: string;
  notes: string | null;
}
