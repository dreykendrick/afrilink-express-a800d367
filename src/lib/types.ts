// AfriLink Checkout Types

export interface Product {
  id: string;
  vendor_id: string;
  slug: string;
  title: string;
  price: number;
  description: string | null;
  category: string | null;
  image_url: string | null;
  image_urls: string[];
  status: string;
  is_available: boolean;
  commission: number | null;
}

export interface BuyerInfo {
  name: string;
  email: string;
  phone: string;
  city: string;
  area: string;
  landmark: string;
  notes: string;
}

export type PaymentStatus = 'pending_payment' | 'paid' | 'confirmed' | 'failed' | 'refunded';

export interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_country: string | null;
  delivery_type: string | null;
  delivery_fee: number;
  total_amount: number;
  status: string;
  affiliate_link_id: string | null;
  confirmation_token: string | null;
  payment_status: string;
  vendor_notified_at: string | null;
  buyer_notes: string | null;
  payment_reference: string | null;
  checkout_session_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  commission_amount: number | null;
  product?: Product;
}

export interface OrderIssue {
  id: string;
  order_id: string;
  reason: string;
  notes: string | null;
}
