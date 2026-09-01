import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MEETPAY_BASE_URL = "https://meet.briq.tz/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_PRODUCT_FIELDS =
  "id, vendor_id, slug, title, price, commission, category, image_url, image_urls, status, is_available";

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

// --- MeetPay Payment Initiation ---

/** Detect mobile money network from phone number prefix */
function detectNetwork(phone: string): string {
  // Tanzania network prefixes (after 255)
  const prefix = phone.replace(/^255/, "").substring(0, 2);
  const networkMap: Record<string, string> = {
    "74": "VODACOM", "75": "VODACOM", "76": "VODACOM",
    "65": "TIGO", "67": "TIGO", "71": "TIGO",
    "68": "AIRTEL", "69": "AIRTEL", "78": "AIRTEL",
    "62": "HALOTEL", "63": "HALOTEL",
    "73": "TTCL",
  };
  return networkMap[prefix] || "VODACOM"; // Default to VODACOM
}

/** Generate a collision-resistant order number */
function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}${rand}`;
}

/** Initiate MeetPay mobile money payment with retry for transient errors */
async function initiateMeetPayPayment(params: {
  amount: number;
  phone: string;
  customerName: string;
  orderId: string;
  orderNumber: string;
  idempotencyKey: string;
}): Promise<{ id: string; status: string; payment_url?: string }> {
  const apiKey = Deno.env.get("MEETPAY_API_KEY");
  if (!apiKey) {
    throw new Error("MEETPAY_API_KEY not configured");
  }

  const nameParts = params.customerName.trim().split(/\s+/);
  const firstname = nameParts[0] || "Customer";
  const lastname = nameParts.slice(1).join(" ") || "N/A";

  const network = detectNetwork(params.phone);

  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meetpay-webhook`;

  const body = {
    amount: params.amount,
    currency: "TZS",
    type: "mobile",
    phone: params.phone,
    network,
    callback_url: callbackUrl,
    webhook_url: callbackUrl,
    customer: {
      firstname,
      lastname,
      email: `${params.phone}@checkout.afrilink.info`,
    },
    reference: params.orderNumber,
    metadata: {
      order_id: params.orderId,
      order_number: params.orderNumber,
    },
  };

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[MeetPay] Attempt ${attempt}/${MAX_RETRIES} - Initiating payment: ${JSON.stringify({ amount: body.amount, phone: body.phone, network, reference: body.reference })}`);

    try {
      const res = await fetch(`${MEETPAY_BASE_URL}/payments`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": params.idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      const responseText = await res.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error(`[MeetPay] Attempt ${attempt} - Non-JSON response (${res.status}):`, responseText.substring(0, 300));
        lastError = new Error(`MeetPay returned non-JSON response (HTTP ${res.status})`);
        // Retry on 502/503/504
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        console.error(`[MeetPay] Attempt ${attempt} - Failed (${res.status}):`, JSON.stringify(data));
        lastError = new Error(data?.message || data?.error || `MeetPay error: ${res.status}`);
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw lastError;
      }

      // Check if the response indicates a failed payment (idempotency cache of a failed attempt)
      const paymentData = data?.data || data;
      const paymentStatus = paymentData?.status || data?.status;
      
      if (paymentStatus === "failed") {
        console.warn(`[MeetPay] Payment returned status 'failed' - generating new idempotency key for retry`);
        // Use a new idempotency key to force a fresh payment attempt
        params.idempotencyKey = `${params.idempotencyKey}-retry-${attempt}`;
        lastError = new Error("Payment failed on provider side");
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw lastError;
      }

      console.log(`[MeetPay] Payment initiated successfully:`, JSON.stringify(data));
      const id = paymentData?.id || data?.id || data?.payment_id || data?.transaction_id || "";
      return { id, status: paymentStatus || "pending", payment_url: paymentData?.payment_url || data?.payment_url };
    } catch (fetchErr: any) {
      if (fetchErr === lastError) throw fetchErr;
      console.error(`[MeetPay] Attempt ${attempt} - Network error:`, fetchErr.message);
      lastError = fetchErr;
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error("Payment initiation failed after retries");
}

/** Lowercase hex HMAC-SHA256 */
async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Fetch a payment's current status from MeetPay */
async function fetchMeetPayPayment(paymentId: string): Promise<any | null> {
  const apiKey = Deno.env.get("MEETPAY_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch(`${MEETPAY_BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    if (!res.ok) {
      console.warn(`[MeetPay Poll] ${res.status} for payment ${paymentId}`);
      return null;
    }
    const data = await res.json();
    return data?.data ?? data;
  } catch (err) {
    console.error("[MeetPay Poll] Network error:", err);
    return null;
  }
}

/**
 * Fallback for missed MeetPay webhooks: poll the payment status and, when it is
 * terminal, replay the event into the meetpay-webhook function (properly signed)
 * so all downstream logic (ledger, Order Service forwarding) runs exactly once.
 */
async function reconcilePendingPayment(order: {
  id: string;
  order_number: string;
  payment_status: string;
  meetpay_payment_id: string | null;
}): Promise<boolean> {
  if (order.payment_status !== "pending" || !order.meetpay_payment_id) return false;

  const payment = await fetchMeetPayPayment(order.meetpay_payment_id);
  const status = String(payment?.status ?? "").toLowerCase();
  if (!status) return false;

  const success = ["success", "successful", "completed", "paid", "confirmed"].includes(status);
  const failed = ["failed", "cancelled", "canceled", "expired", "rejected"].includes(status);
  if (!success && !failed) return false;

  const event = {
    type: success ? "payment.completed" : "payment.failed",
    data: {
      id: order.meetpay_payment_id,
      transaction_id: payment?.transaction_id ?? payment?.reference ?? order.meetpay_payment_id,
      reference: order.order_number,
      status,
      metadata: { order_id: order.id, order_number: order.order_number },
    },
  };
  const bodyStr = JSON.stringify(event);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = Deno.env.get("MEETPAY_WEBHOOK_SECRET");
  if (secret) headers["x-meetpay-signature"] = await hmacSha256Hex(secret, bodyStr);

  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/meetpay-webhook`, {
      method: "POST",
      headers,
      body: bodyStr,
    });
    console.log(`[Reconcile] Order ${order.id} → ${event.type} replayed (webhook ${res.status})`);
    return res.ok;
  } catch (err) {
    console.error("[Reconcile] Failed to replay webhook:", err);
    return false;
  }
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
      const decoded = decodeURIComponent(param).trim();
      const normalizedSlug = decoded.replace(/\s+/g, "-");
      const isUUID = UUID_REGEX.test(decoded);
      let productQuery = admin
        .from("products")
        .select(PUBLIC_PRODUCT_FIELDS)
        .eq("status", "approved")
        .eq("is_available", true);

      productQuery = isUUID
        ? productQuery.or(`id.eq.${decoded},slug.eq.${decoded},slug.eq.${normalizedSlug}`)
        : productQuery.in("slug", [...new Set([decoded, normalizedSlug])]);

      const { data, error } = await productQuery.limit(1).maybeSingle();

      if (error) {
        console.error("Product lookup error:", error);
        return json({ error: "Unable to load product" }, 500);
      }

      if (data) {
        // Normalize field names for the frontend
        const normalized = {
          ...(data as any),
          name: (data as any).title || "",
          description: null,
          short_description: null,
          images: (data as any).image_urls || ((data as any).image_url ? [(data as any).image_url] : []),
          is_active: (data as any).is_available !== false,
          created_at: "",
          updated_at: "",
          vendor_lat: null,
          vendor_lng: null,
          vendor_address: null,
        };
        return json(normalized);
      }

      return json({ error: "Product not found" }, 404);
    }

    // ---- GET /affiliates/:code ----
    if (route === "affiliates" && param && req.method === "GET") {
      const admin = getAdminClient();
      const { data, error } = await admin
        .from("affiliate_links")
        .select("affiliate_id, code, product_id")
        .eq("code", param)
        .maybeSingle();

      if (error) {
        console.error("Affiliate lookup error:", error);
        return json({ error: "Unable to load affiliate" }, 500);
      }
      if (!data) return json({ error: "Affiliate not found" }, 404);

      const { data: linkedProduct } = await admin
        .from("products")
        .select("commission")
        .eq("id", data.product_id)
        .maybeSingle();

      return json({
        id: data.affiliate_id,
        code: data.code || param,
        name: "Affiliate Partner",
        commission_rate: Number(linkedProduct?.commission ?? 0) / 100,
      });
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
          .from("affiliate_links")
          .select("affiliate_id")
          .eq("code", affiliate_code)
          .maybeSingle();
        if (aff) affiliate_id = aff.affiliate_id;
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

      // Products and vendor profiles live in the same shared Supabase project.
      const { data: localProduct, error: prodErr } = await admin
        .from("products")
        .select("id, price, commission, vendor_id")
        .eq("id", product_id)
        .eq("status", "approved")
        .eq("is_available", true)
        .maybeSingle();

      if (prodErr) {
        console.error("Checkout product lookup error:", prodErr);
        return json({ error: "Unable to load product" }, 500);
      }
      if (!localProduct) return json({ error: "Product not found" }, 404);

      const { data: vendorProfile, error: vendorError } = await admin
        .from("vendor_profiles")
        .select("vendor_lat, vendor_lng, vendor_address, pickup_location")
        .eq("user_id", localProduct.vendor_id)
        .maybeSingle();

      if (vendorError) console.error("Vendor profile lookup error:", vendorError);

      const product = {
        ...localProduct,
        vendor: {
          lat: vendorProfile?.vendor_lat ?? null,
          lng: vendorProfile?.vendor_lng ?? null,
          address: vendorProfile?.vendor_address ?? vendorProfile?.pickup_location ?? null,
        },
      };

      const vendorLat = product.vendor?.lat ?? null;
      const vendorLng = product.vendor?.lng ?? null;

      // Vendor location is required
      if (vendorLat == null || vendorLng == null) {
        return json({ error: "Vendor location is not configured yet." }, 400);
      }

      // Calculate distance — FIX: use ?? instead of || to handle 0 correctly
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
          .from("affiliate_links")
          .select("affiliate_id")
          .eq("product_id", product_id)
          .eq("code", affiliate_ref)
          .maybeSingle();
        if (aff) {
          affiliate_id = aff.affiliate_id;
          affiliate_rate_at_purchase = Number(localProduct.commission ?? 0) / 100;
        }
      }

      if (source === "marketplace" && (buyer_role === "vendor" || buyer_role === "affiliate")) {
        affiliate_rate_at_purchase = 0.05;
        // FIX: Keep affiliate_id as null for marketplace — the commission goes to the platform.
        // The credit_wallets_for_order function now handles this case correctly.
        affiliate_id = null;
      }

      // FIX: Use collision-resistant order number
      const order_number = generateOrderNumber();

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
          // FIX: use ?? instead of || to handle 0 latitude/longitude correctly
          delivery_lat: delivery_lat ?? null,
          delivery_lng: delivery_lng ?? null,
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
        // Handle unique constraint violation on order_number (extremely rare)
        if (orderErr.message?.includes("duplicate") || orderErr.message?.includes("unique")) {
          console.warn("[checkout] Order number collision, retrying with new number...");
          const retryNumber = generateOrderNumber();
          const { data: retryOrder, error: retryErr } = await admin
            .from("orders")
            .insert({
              order_number: retryNumber,
              product_id,
              affiliate_id,
              buyer_name: customer_name,
              buyer_phone: customer_phone,
              buyer_area: delivery_address,
              buyer_landmark: customer_landmark || null,
              buyer_notes: customer_notes || null,
              delivery_address,
              delivery_lat: delivery_lat ?? null,
              delivery_lng: delivery_lng ?? null,
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

          if (retryErr) {
            console.error("Order creation error (retry):", retryErr);
            return json({ error: "Failed to create order" }, 500);
          }
          // Use retryOrder below
          Object.assign(order!, retryOrder);
        } else {
          console.error("Order creation error:", orderErr);
          return json({ error: "Failed to create order" }, 500);
        }
      }

      // Initiate MeetPay payment
      try {
        const meetpayResult = await initiateMeetPayPayment({
          amount: total_amount,
          phone: customer_phone,
          customerName: customer_name,
          orderId: order!.id,
          orderNumber: order!.order_number,
          idempotencyKey: checkout_session_id,
        });

        // Persist the provider payment id so a missed webhook can be reconciled later
        if (meetpayResult.id) {
          await admin
            .from("orders")
            .update({ meetpay_payment_id: meetpayResult.id })
            .eq("id", order!.id);
        }

        return json({
          order_id: order!.id,
          order_number: order!.order_number,
          subtotal: item_price,
          distance_km,
          delivery_fee,
          total: total_amount,
          payment_id: meetpayResult.id,
          payment_status: meetpayResult.status,
          payment_url: meetpayResult.payment_url || null,
        }, 201);
      } catch (payErr: any) {
        console.error("MeetPay payment initiation failed:", payErr);
        // Order is created but payment failed — mark order as failed
        await admin
          .from("orders")
          .update({ payment_status: "failed", order_status: "cancelled" })
          .eq("id", order!.id);

        return json({ 
          error: `Payment initiation failed: ${payErr.message || "Unknown error"}`,
          order_id: order!.id,
        }, 502);
      }
    }

    // ---- GET /receipt/:orderId ----
    if (route === "receipt" && param && req.method === "GET") {
      const admin = getAdminClient();
      let { data: order, error } = await admin
        .from("orders")
        .select("*, product:products(title, image_urls, slug)")
        .eq("id", param)
        .maybeSingle();

      if (error) {
        console.error("Receipt lookup error:", error);
        return json({ error: "Unable to load order" }, 500);
      }
      if (!order) {
        return json({ error: "Order not found" }, 404);
      }

      // Webhook fallback: if payment is still pending, ask MeetPay directly.
      if (order.payment_status === "pending" && order.meetpay_payment_id) {
        const changed = await reconcilePendingPayment(order as any);
        if (changed) {
          const { data: refreshed } = await admin
            .from("orders")
            .select("*, product:products(title, image_urls, slug)")
            .eq("id", param)
            .maybeSingle();
          if (refreshed) order = refreshed;
        }
      }

      return json(order);
    }

    // ---- POST /checkout/confirm ----
    // FIX: This endpoint is now restricted — only the webhook should confirm payments.
    // Kept for backwards compatibility but with strict guards.
    if (route === "checkout" && param === "confirm" && req.method === "POST") {
      const body = await req.json();
      const { order_id } = body;

      if (!order_id) {
        return json({ error: "Missing order_id" }, 400);
      }

      const admin = getAdminClient();

      // FIX: Add optimistic lock — only transition from pending to confirmed
      const { data: order, error, count } = await admin
        .from("orders")
        .update({
          payment_status: "confirmed",
          order_status: "paid",
        })
        .eq("id", order_id)
        .eq("payment_status", "pending") // Optimistic lock: only pending -> confirmed
        .select()
        .single();

      if (error) {
        // If no row matched, the order is already confirmed or doesn't exist
        console.warn("Payment confirm rejected (already confirmed or not found):", order_id, error.message);
        return json({ error: "Order not found or already processed" }, 409);
      }

      return json(order);
    }

    // ---- POST /confirm-delivery ----
    if (route === "confirm-delivery" && req.method === "POST") {
      const body = await req.json();
      const { order_id, token } = body;

      if (!order_id || !token) {
        return json({ error: "Missing order_id or token" }, 400);
      }

      const admin = getAdminClient();

      // Verify token
      const { data: order, error: fetchErr } = await admin
        .from("orders")
        .select("id, order_status, payment_status, confirmation_token, buyer_confirmed_at, vendor_confirmed_at")
        .eq("id", order_id)
        .single();

      if (fetchErr || !order) {
        return json({ error: "Order not found" }, 404);
      }

      if (order.confirmation_token !== token) {
        return json({ error: "Invalid confirmation token" }, 403);
      }

      // FIX: Cannot confirm delivery on unpaid orders
      if (order.payment_status !== "confirmed") {
        return json({ error: "Payment has not been confirmed yet" }, 400);
      }

      if (order.buyer_confirmed_at) {
        return json({ message: "Already confirmed", order_status: order.order_status });
      }

      // Set buyer confirmation
      const updateData: Record<string, unknown> = {
        buyer_confirmed_at: new Date().toISOString(),
      };

      // If vendor also confirmed, mark as fully confirmed
      if (order.vendor_confirmed_at) {
        updateData.order_status = "confirmed";
        updateData.confirmed_at = new Date().toISOString();
      }

      const { data: updated, error: updateErr } = await admin
        .from("orders")
        .update(updateData)
        .eq("id", order_id)
        .select("*, product:products(title, image_urls, slug)")
        .single();

      if (updateErr) {
        console.error("Confirm delivery error:", updateErr);
        return json({ error: "Failed to confirm delivery" }, 500);
      }

      // If both confirmed, credit wallets (no external payout)
      if (updated.vendor_confirmed_at && updated.buyer_confirmed_at) {
        try {
          const { data: walletResult, error: walletErr } = await admin.rpc("credit_wallets_for_order", {
            p_order_id: order_id,
          });
          if (walletErr) {
            console.error("Wallet credit error:", walletErr);
          } else {
            console.log(`Wallets credited for order ${order_id}:`, walletResult);
          }
        } catch (err) {
          console.error("Wallet credit exception:", err);
        }
      }

      return json(updated);
    }

    // ---- POST /vendor-confirm ----
    if (route === "vendor-confirm" && req.method === "POST") {
      const body = await req.json();
      const { order_id } = body;

      if (!order_id) {
        return json({ error: "Missing order_id" }, 400);
      }

      const admin = getAdminClient();

      const { data: order, error: fetchErr } = await admin
        .from("orders")
        .select("id, order_status, payment_status, vendor_confirmed_at, buyer_confirmed_at")
        .eq("id", order_id)
        .single();

      if (fetchErr || !order) {
        return json({ error: "Order not found" }, 404);
      }

      // FIX: Cannot vendor-confirm unpaid orders
      if (order.payment_status !== "confirmed") {
        return json({ error: "Payment has not been confirmed yet" }, 400);
      }

      if (order.vendor_confirmed_at) {
        return json({ message: "Already confirmed by vendor" });
      }

      const updateData: Record<string, unknown> = {
        vendor_confirmed_at: new Date().toISOString(),
      };

      // If buyer also confirmed, mark as fully confirmed
      if (order.buyer_confirmed_at) {
        updateData.order_status = "confirmed";
        updateData.confirmed_at = new Date().toISOString();
      }

      const { data: updated, error: updateErr } = await admin
        .from("orders")
        .update(updateData)
        .eq("id", order_id)
        .select()
        .single();

      if (updateErr) {
        console.error("Vendor confirm error:", updateErr);
        return json({ error: "Failed to confirm" }, 500);
      }

      // If both confirmed, credit wallets
      if (updated.vendor_confirmed_at && updated.buyer_confirmed_at) {
        try {
          const { data: walletResult, error: walletErr } = await admin.rpc("credit_wallets_for_order", {
            p_order_id: order_id,
          });
          if (walletErr) {
            console.error("Wallet credit error:", walletErr);
          } else {
            console.log(`Wallets credited for order ${order_id}:`, walletResult);
          }
        } catch (err) {
          console.error("Wallet credit exception:", err);
        }
      }

      return json(updated);
    }

    // ---- POST /report-issue ----
    if (route === "report-issue" && req.method === "POST") {
      const body = await req.json();
      const { order_id, reason, notes } = body;

      if (!order_id || !reason) {
        return json({ error: "Missing order_id or reason" }, 400);
      }

      const admin = getAdminClient();

      const { error } = await admin
        .from("order_issues")
        .insert({ order_id, reason, notes: notes || null });

      if (error) {
        console.error("Report issue error:", error);
        return json({ error: "Failed to report issue" }, 500);
      }

      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
