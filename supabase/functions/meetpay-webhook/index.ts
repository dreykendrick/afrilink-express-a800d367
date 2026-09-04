import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ORDER_SERVICE_URL = "https://order-guardian.vercel.app";

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

/** Compute lowercase hex HMAC-SHA256 of `body` with the given `secret`. */
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
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verify MeetPay webhook signature if secret is configured */
async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get("MEETPAY_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("MEETPAY_WEBHOOK_SECRET not set — skipping signature verification");
    return true;
  }
  if (!signatureHeader) {
    console.error("Missing webhook signature header");
    return false;
  }

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // Constant-time comparison
    if (expected.length !== signatureHeader.length) return false;
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
    }
    return result === 0;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

/** Generate ledger entries for a paid order */
async function generateLedgerEntries(admin: ReturnType<typeof getAdminClient>, orderId: string) {
  // Check if ledger entries already exist (idempotency)
  const { data: existing } = await admin
    .from("order_ledger")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`Ledger entries already exist for order ${orderId} — skipping`);
    return;
  }

  // Fetch order with product info
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("*, products(vendor_id)")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    console.error("Failed to fetch order for ledger:", orderErr);
    return;
  }

  const PLATFORM_FEE_RATE = 0.10; // 10%
  const commissionRate = order.affiliate_rate_at_purchase ?? 0;
  const itemPrice = order.item_price;

  const commissionAmount = commissionRate * itemPrice;
  const platformFee = PLATFORM_FEE_RATE * itemPrice;
  const vendorPayout = itemPrice - platformFee - commissionAmount;

  const vendorId = order.products?.vendor_id ?? null;

  const entries: Array<Record<string, unknown>> = [
    // Vendor payout
    {
      order_id: orderId,
      entry_type: "vendor_payout",
      recipient_id: vendorId,
      recipient_type: "vendor",
      amount: Math.max(vendorPayout, 0),
    },
    // Platform fee
    {
      order_id: orderId,
      entry_type: "platform_fee",
      recipient_type: "platform",
      amount: platformFee,
    },
  ];

  // Commission routing based on source + buyer role
  if (commissionAmount > 0) {
    if (order.source === "affiliate_link" && order.affiliate_id) {
      // Affiliate gets the commission
      entries.push({
        order_id: orderId,
        entry_type: "affiliate_commission",
        recipient_id: order.affiliate_id,
        recipient_type: "affiliate",
        amount: commissionAmount,
      });
    } else if (
      order.source === "marketplace" &&
      (order.buyer_role === "vendor" || order.buyer_role === "affiliate")
    ) {
      // Platform gets the commission (marketplace purchase by vendor/affiliate)
      entries.push({
        order_id: orderId,
        entry_type: "platform_commission",
        recipient_type: "platform",
        amount: commissionAmount,
      });
    }
    // For marketplace guest/customer: no commission entry
  }

  const { error: insertErr } = await admin.from("order_ledger").insert(entries);

  if (insertErr) {
    console.error("Failed to insert ledger entries:", insertErr);
  } else {
    console.log(`Created ${entries.length} ledger entries for order ${orderId}`);
  }
}

/**
 * Forward a confirmed order to the external Order Service.
 * - Idempotent: skips if `external_forwarded_at` is already set.
 * - Retries up to 3 times with exponential backoff on transient failures.
 * - Persists tracking_url / tracking_token / external_order_id on the order.
 * Returns the tracking_url if available, otherwise null.
 * Notifications (SMS) are now handled by the Order Service — we no longer
 * call notify-vendor from the webhook.
 */
async function forwardOrderToService(
  admin: ReturnType<typeof getAdminClient>,
  orderId: string,
  paymentReference: string | null,
): Promise<string | null> {
  // Load the checkout order first. Product/vendor details live in the shared
  // Winger schema, where products use title and vendor profiles are keyed by
  // vendor_profiles.user_id, not an old products.name -> vendors join.
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select(
      "id, order_number, external_forwarded_at, tracking_url, product_id, buyer_name, buyer_phone, delivery_address, item_price, delivery_fee, total_amount, affiliate_rate_at_purchase",
    )
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    console.error("[OrderService] Failed to load order for forwarding:", orderErr);
    return null;
  }

  // Idempotency guard
  if (order.external_forwarded_at) {
    console.log(`[OrderService] Order ${orderId} already forwarded — skipping`);
    return order.tracking_url ?? null;
  }

  const { data: product, error: productErr } = await admin
    .from("products")
    .select("id, title, vendor_id, commission")
    .eq("id", order.product_id)
    .maybeSingle();

  if (productErr || !product) {
    console.error("[OrderService] Failed to load product for forwarding:", productErr);
    return null;
  }

  const { data: vendorProfile, error: vendorErr } = await admin
    .from("vendor_profiles")
    .select("business_name")
    .eq("user_id", product.vendor_id)
    .maybeSingle();

  if (vendorErr) {
    console.warn("[OrderService] Failed to load vendor profile for forwarding:", vendorErr.message);
  }

  const payload = {
    product_id: order.product_id,
    product_name: product.title ?? "Product",
    vendor_id: product.vendor_id,
    vendor_phone: null,
    vendor_business_name: vendorProfile?.business_name ?? null,
    customer_name: order.buyer_name,
    customer_phone: order.buyer_phone,
    delivery_address: order.delivery_address,
    amount: order.item_price,
    delivery_fee: order.delivery_fee,
    total_amount: order.total_amount,
    payment_reference: paymentReference ?? order.order_number ?? orderId,
    quantity: 1,
    affiliate_commission_pct: Number(order.affiliate_rate_at_purchase ?? product.commission ?? 0) * 100,
  };

  const bodyStr = JSON.stringify(payload);

  // Sign the exact body with HMAC-SHA256 using the shared secret.
  const secret = Deno.env.get("ORDER_GUARDIAN_SECRET") ?? "";
  if (!secret) {
    console.error("[OrderService] Missing ORDER_GUARDIAN_SECRET — cannot sign request");
    return null;
  }
  const signature = await hmacSha256Hex(secret, bodyStr);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-checkout-signature": signature,
    // Retained for backwards-compat / operator observability
    "Idempotency-Key": orderId,
  };

  const maxAttempts = 3;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${ORDER_SERVICE_URL}/api/public/orders/create`, {
        method: "POST",
        headers,
        body: bodyStr,
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const trackingUrl = body?.tracking_url ?? null;
        const trackingToken = body?.tracking_token ?? null;
        const externalOrderId = body?.id ?? body?.order_id ?? null;

        await admin
          .from("orders")
          .update({
            external_order_id: externalOrderId,
            tracking_token: trackingToken,
            tracking_url: trackingUrl,
            external_forwarded_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        console.log(`[OrderService] Forwarded order ${orderId} → ${externalOrderId ?? "(no id)"}`);
        return trackingUrl;
      }

      // Don't retry on 4xx (except 408/429) — those are payload problems
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        const body = await res.text();
        console.error(`[OrderService] ${res.status} (no retry):`, body);
        return null;
      }

      lastErr = `HTTP ${res.status}`;
    } catch (err) {
      lastErr = err;
    }

    if (attempt < maxAttempts) {
      const delay = 500 * Math.pow(2, attempt - 1); // 500ms, 1s, 2s
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.error(`[OrderService] Failed to forward order ${orderId} after ${maxAttempts} attempts:`, lastErr);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const rawBody = await req.text();

    // Verify webhook signature
    const signature = req.headers.get("x-meetpay-signature") 
      ?? req.headers.get("x-webhook-signature");
    
    if (!(await verifySignature(rawBody, signature))) {
      console.error("Invalid webhook signature");
      return json({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.type ?? event?.event_type ?? "unknown";
    console.log(`[MeetPay Webhook] Event received: ${eventType}`, JSON.stringify(event).substring(0, 500));

    const admin = getAdminClient();

    // Extract order_id from MeetPay payload — check multiple possible locations
    let orderId = event?.data?.metadata?.order_id
      ?? event?.metadata?.order_id
      ?? event?.data?.order_id;

    // Fallback: look up by reference (order_number)
    const reference = event?.data?.reference ?? event?.reference;
    // MeetPay transaction id (unique per payment attempt) — used as payment_reference
    const meetpayTxnId = event?.data?.transaction_id
      ?? event?.data?.txn_id
      ?? event?.data?.id
      ?? event?.transaction_id
      ?? null;
    if (!orderId && reference) {
      console.log(`[MeetPay Webhook] No order_id in payload, looking up by reference: ${reference}`);
      const { data: orderByRef } = await admin
        .from("orders")
        .select("id")
        .eq("order_number", reference)
        .maybeSingle();
      if (orderByRef) {
        orderId = orderByRef.id;
        console.log(`[MeetPay Webhook] Found order by reference: ${orderId}`);
      }
    }

    if (eventType === "payment.completed" || eventType === "payment.success") {
      if (!orderId) {
        console.error("[MeetPay Webhook] No order_id resolved from payload:", JSON.stringify(event));
        return json({ error: "Missing order_id" }, 400);
      }

      // Fetch current order state
      const { data: order, error: fetchErr } = await admin
        .from("orders")
        .select("id, payment_status, order_status")
        .eq("id", orderId)
        .single();

      if (fetchErr || !order) {
        console.error("Order not found:", orderId, fetchErr);
        return json({ error: "Order not found" }, 404);
      }

      // Idempotency: already confirmed
      if (order.payment_status === "confirmed") {
        console.log(`Order ${orderId} already confirmed — idempotent return`);
        return json({ ok: true, message: "Already processed" });
      }

      // Update order status atomically
      // DB constraint allows: 'pending', 'confirmed', 'failed', 'refunded'
      const { error: updateErr } = await admin
        .from("orders")
        .update({
          payment_status: "confirmed",
          order_status: "paid",
        })
        .eq("id", orderId)
        .eq("payment_status", "pending"); // Optimistic lock

      if (updateErr) {
        console.error("Failed to update order:", updateErr);
        return json({ error: "Failed to process payment" }, 500);
      }

      // Generate ledger entries (idempotent internally)
      await generateLedgerEntries(admin, orderId);

      // Forward to external Order Service (handles notifications/SMS itself)
      const paymentReference = meetpayTxnId ?? reference ?? orderId;
      await forwardOrderToService(admin, orderId, paymentReference);

      console.log(`Order ${orderId} marked as paid, ledger generated, forwarded to Order Service`);
      return json({ ok: true });
    }

    if (eventType === "payment.failed" || eventType === "payment.failure") {
      if (!orderId) {
        return json({ error: "Missing order_id" }, 400);
      }

      // FIX: Only transition from pending to failed — never overwrite confirmed
      const { error: updateErr } = await admin
        .from("orders")
        .update({
          payment_status: "failed",
          order_status: "cancelled",
        })
        .eq("id", orderId)
        .eq("payment_status", "pending"); // Optimistic lock: only pending -> failed

      if (updateErr) {
        console.warn(`[Webhook] Failed to mark order ${orderId} as failed (may already be confirmed):`, updateErr.message);
      } else {
        console.log(`Order ${orderId} marked as failed`);
      }

      return json({ ok: true });
    }

    // Unhandled event type — acknowledge
    console.log(`Unhandled MeetPay event type: ${eventType}`);
    return json({ ok: true, message: "Event type not handled" });

  } catch (err) {
    console.error("Webhook processing error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
