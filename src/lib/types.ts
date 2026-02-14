// AfriLink Checkout Types

export interface City {
  id: string;
  name: string;
}

export interface SameCityZone {
  id: string;
  city_id: string;
  zone_name: string;
  fee: number;
}

export interface CrossCityFee {
  id: string;
  from_city_id: string;
  to_city_id: string;
  fee: number;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  city_id: string | null;
  address: string | null;
  city?: City;
}

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

export interface Affiliate {
  id: string;
  code: string;
  name: string;
  commission_rate: number;
}

export interface BuyerInfo {
  name: string;
  phone: string;
  city: string;
  area: string;
  landmark: string;
  notes: string;
}

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';
export type OrderStatus = 'pending_payment' | 'paid' | 'preparing' | 'out_for_delivery' | 'delivered' | 'confirmed' | 'cancelled';

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
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  vendor_notified_at: string | null;
  notification_status: string | null;
  confirmation_token: string;
  confirmed_at: string | null;
  created_at: string;
  product?: Product;
  buyer_city?: City;
}

export interface OrderIssue {
  id: string;
  order_id: string;
  reason: string;
  notes: string | null;
}
