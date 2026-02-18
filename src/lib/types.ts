// AfriLink Checkout Types

export interface Product {
  id: string;
  vendor_id: string;
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

export interface BuyerInfo {
  name: string;
  phone: string;
  city: string;
  area: string;
  landmark: string;
  notes: string;
}

export type PaymentStatus = 'pending_payment' | 'paid' | 'confirmed' | 'failed' | 'refunded';

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
  // Joined
  product?: Product;
}

export interface OrderIssue {
  id: string;
  order_id: string;
  reason: string;
  notes: string | null;
}
