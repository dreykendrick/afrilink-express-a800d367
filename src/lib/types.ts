// AfriLink Checkout Types

export interface Product {
  id: string;
  vendor_id: string;
  vendor_city_id: string | null;
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

export interface DeliveryFeeData {
  cities: Array<{ id: string; name: string }>;
  zones: Array<{ id: string; city_id: string; city_name: string | null; zone_name: string; fee: number }>;
  cross_city_fees: Array<{ id: string; from_city_id: string; to_city_id: string; fee: number }>;
}

export interface BuyerInfo {
  name: string;
  phone: string;
  city: string;
  zone_id: string;
  area: string;
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
  customer_city_id: string;
  customer_area: string;
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
  buyer_city_id: string;
  buyer_area: string;
  buyer_landmark: string | null;
  buyer_notes: string | null;
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
  // Joined
  product?: Product;
}

export interface OrderIssue {
  id: string;
  order_id: string;
  reason: string;
  notes: string | null;
}
