import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_PRODUCT_FIELDS =
  "id, vendor_id, slug, name, price, description, short_description, images, is_active, created_at, updated_at";

const EARTH_RADIUS_KM = 6371;

function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Haversine ---
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Delivery Settings ---
const DEFAULT_SETTINGS = {
  enabled: true,
  base_fee: 1500,
  price_per_km: 500,
  minimum_fee: 1500,
  maximum_fee: null,
  free_delivery_threshold: null,
  max_delivery_distance_km: null,
};

async function getDeliverySettings(admin: ReturnType<typeof getAdminClient>) {
  const { data, error } = await admin
    .from("delivery_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !data) return DEFAULT_SETTINGS;
  return {
    enabled: data.enabled ?? true,
    base_fee: data.base_fee ?? 1500,
    price_per_km: data.price_per_km ?? 500,
    minimum_fee: data.minimum_fee ?? 1500,
    maximum_fee: data.maximum_fee ?? null,
    free_delivery_threshold: data.free_delivery_threshold ?? null,
    max_delivery_distance_km: data.max_delivery_distance_km ?? null,
  };
}

function calculateDeliveryFee(
  settings: typeof DEFAULT_SETTINGS,
  distanceKm: number,
  subtotal: number
): { fee: number; blocked: boolean; message?: string } {
  if (!settings.enabled) return { fee: 0, blocked: false };

  if (settings.max_delivery_distance_km != null && distanceKm > settings.max_delivery_distance_km) {
    return {
      fee: 0,
      blocked: true,
      message: `Delivery not available beyond ${settings.max_delivery_distance_km} km (distance: ${distanceKm} km)`,
    };
  }

  if (settings.free_delivery_threshold != null && subtotal >= settings.free_delivery_threshold) {
    return { fee: 0, blocked: false };
  }

  let fee = settings.base_fee + distanceKm * settings.price_per_km;
  fee = Math.max(fee, settings.minimum_fee);
  if (settings.maximum_fee != null) fee = Math.min(fee, settings.maximum_fee);
  fee = Math.round(fee / 100) * 100;

  return { fee, blocked: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const segments = url.pathname.replace(/^\/checkout-api\/?/, "").split("/").filter(Boolean);
    const route = segments[0] || "";
    const param = segments[1] || "";

    // ---- GET /products/:idOrSlug ----
    if (route === "products" && param && req.method === "GET") {
      const admin = getAdminClient();
      const isUUID = UUID_REGEX.test(param);
      const column = isUUID ? "id" : "slug";

      const { data, error } = await admin
        .from("products")
        .select(`${PUBLIC_PRODUCT_FIELDS}, vendor:vendors(lat, lng)`)
        .eq(column, param)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Product lookup error:", error);
        return json({ error: "Unable to load product" }, 500);
      }
      if (!data) {
        return json({ error: "Product not found" }, 404);
      }
      const vendor_lat = (data as any).vendor?.lat ?? null;
      const vendor_lng = (data as any).vendor?.lng ?? null;
      const vendor_address = (data as any).vendor?.address ?? null;
      const { vendor, ...rest } = data as any;
      return json({ ...rest, vendor_lat, vendor_lng, vendor_address });
    }

    // ---- GET /affiliates/:code ----
    if (route === "affiliates" && param && req.method === "GET") {
      const admin = getAdminClient();
      const { data, error } = await admin
        .from("affiliates")
        .select("id, code, name, commission_rate")
        .eq("code", param)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Affiliate lookup error:", error);
        return json({ error: "Unable to load affiliate" }, 500);
      }
      if (!data) {
        return json({ error: "Affiliate not found" }, 404);
      }
      return json(data);
    }

    // ---- GET /delivery-settings ----
    if (route === "delivery-settings" && req.method === "GET") {
      const admin = getAdminClient();
      const settings = await getDeliverySettings(admin);
      return json(settings);
    }

    // ---- POST /affiliate-clicks or /track-click ----
    if ((route === "affiliate-clicks" || route === "track-click") && req.method === "POST") {
      const body = await req.json();
      let { affiliate_id, product_id, session_id, affiliate_code } = body;

      if (!product_id || !session_id) {
        return json({ error: "Missing required fields" }, 400);
      }

      const admin = getAdminClient();

      if (!affiliate_id && affiliate_code) {
        const { data: aff } = await admin
          .from("affiliates")
          .select("id")
          .eq("code", affiliate_code)
          .eq("is_active", true)
          .maybeSingle();
        if (aff) affiliate_id = aff.id;
      }

      if (!affiliate_id) {
        return json({ error: "Invalid affiliate" }, 400);
      }

      const { error } = await admin
        .from("affiliate_clicks")
        .insert({ affiliate_id, product_id, session_id });

      if (error) {
        if (error.message?.includes("duplicate")) {
          return json({ ok: true, duplicate: true });
        }
        console.error("Click tracking error:", error);
        return json({ error: "Failed to track click" }, 500);
      }
      return json({ ok: true });
    }

    // ---- POST /checkout/create ----
    if (route === "checkout" && param === "create" && req.method === "POST") {
      const body = await req.json();
      const {
        product_id, customer_name, customer_phone,
        delivery_address, delivery_lat, delivery_lng,
        customer_landmark, customer_notes,
        source, buyer_user_id, buyer_role, affiliate_ref, checkout_session_id,
      } = body;

      if (!product_id || !customer_name || !customer_phone || !delivery_address || !source || !checkout_session_id) {
        return json({ error: "Missing required fields" }, 400);
      }

      const admin = getAdminClient();

      // Look up product + vendor coordinates
      const { data: product, error: prodErr } = await admin
        .from("products")
        .select("id, price, vendor_id, vendor:vendors(lat, lng, address)")
        .eq("id", product_id)
        .eq("is_active", true)
        .maybeSingle();

      if (prodErr || !product) {
        return json({ error: "Product not found" }, 404);
      }

      const vendorLat = (product as any).vendor?.lat ?? null;
      const vendorLng = (product as any).vendor?.lng ?? null;

      // Vendor location is required
      if (vendorLat == null || vendorLng == null) {
        return json({ error: "Vendor location is not configured yet." }, 400);
      }

      // Calculate distance
      let distance_km = 0;
      if (delivery_lat != null && delivery_lng != null) {
        distance_km = Math.round(haversineDistance(vendorLat, vendorLng, delivery_lat, delivery_lng) * 10) / 10;
      }

      // Get delivery settings & calculate fee
      const settings = await getDeliverySettings(admin);
      const item_price = product.price;
      const subtotal = item_price;

      const deliveryCalc = calculateDeliveryFee(settings, distance_km, subtotal);
      if (deliveryCalc.blocked) {
        return json({ error: deliveryCalc.message || "Delivery not available to this location" }, 400);
      }

      const delivery_fee = deliveryCalc.fee;
      const total_amount = subtotal + delivery_fee;

      // Resolve affiliate
      let affiliate_id: string | null = null;
      let affiliate_rate_at_purchase: number | null = null;

      if (source === "affiliate_link" && affiliate_ref) {
        const { data: aff } = await admin
          .from("affiliates")
          .select("id, commission_rate")
          .eq("code", affiliate_ref)
          .eq("is_active", true)
          .maybeSingle();
        if (aff) {
          affiliate_id = aff.id;
          affiliate_rate_at_purchase = aff.commission_rate;
        }
      }

      if (source === "marketplace" && (buyer_role === "vendor" || buyer_role === "affiliate")) {
        affiliate_rate_at_purchase = 0.05;
        affiliate_id = null;
      }

      const order_number = `ORD-${Date.now().toString(36).toUpperCase()}`;

      const { data: order, error: orderErr } = await admin
        .from("orders")
        .insert({
          order_number,
          product_id,
          affiliate_id,
          buyer_name: customer_name,
          buyer_phone: customer_phone,
          buyer_area: delivery_address,
          buyer_landmark: customer_landmark || null,
          buyer_notes: customer_notes || null,
          delivery_address,
          delivery_lat: delivery_lat || null,
          delivery_lng: delivery_lng || null,
          distance_km,
          item_price,
          delivery_fee,
          total_amount,
          order_status: "pending_payment",
          payment_status: "pending",
          delivery_settings_snapshot: settings,
          ...(source ? { source } : {}),
          ...(buyer_user_id ? { buyer_user_id } : {}),
          ...(buyer_role ? { buyer_role } : {}),
          ...(affiliate_rate_at_purchase !== null ? { affiliate_rate_at_purchase } : {}),
        })
        .select("id, order_number")
        .single();

      if (orderErr) {
        console.error("Order creation error:", orderErr);
        return json({ error: "Failed to create order" }, 500);
      }

      return json({
        order_id: order.id,
        order_number: order.order_number,
        subtotal: item_price,
        distance_km,
        delivery_fee,
        total: total_amount,
      }, 201);
    }

    // ---- POST /checkout/confirm ----
    if (route === "checkout" && param === "confirm" && req.method === "POST") {
      const body = await req.json();
      const { order_id } = body;

      if (!order_id) {
        return json({ error: "Missing order_id" }, 400);
      }

      const admin = getAdminClient();

      const { data: order, error } = await admin
        .from("orders")
        .update({
          payment_status: "paid",
          order_status: "paid",
        })
        .eq("id", order_id)
        .select()
        .single();

      if (error) {
        console.error("Payment confirm error:", error);
        return json({ error: "Failed to confirm payment" }, 500);
      }

      return json(order);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
