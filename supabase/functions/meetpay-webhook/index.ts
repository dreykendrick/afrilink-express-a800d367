import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

/** Verify MeetPay webhook signature if secret is configured */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
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
    const hmac = createHmac("sha256", secret);
    hmac.update(rawBody);
    const expected = hmac.digest("hex");
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

/** Trigger vendor notification after successful payment */
async function triggerVendorNotification(orderId: string) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const res = await fetch(`${supabaseUrl}/functions/v1/notify-vendor`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Webhook] Vendor notification failed (${res.status}):`, body);
    } else {
      console.log(`[Webhook] Vendor notification triggered for order ${orderId}`);
    }
  } catch (err) {
    console.error("[Webhook] Vendor notification error:", err);
    // Non-blocking: don't fail the webhook if notification fails
  }
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
    
    if (!verifySignature(rawBody, signature)) {
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

      // FIX: Trigger vendor notification after successful payment
      await triggerVendorNotification(orderId);

      console.log(`Order ${orderId} marked as paid, ledger generated, vendor notified`);
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
          order_status: "failed",
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
