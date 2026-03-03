import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
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

function verifyAdminKey(req: Request): boolean {
  const key = req.headers.get("x-admin-key");
  const expected = Deno.env.get("ADMIN_API_KEY");
  if (!expected || !key) return false;
  if (key.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < key.length; i++) {
    result |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

function getSearchParams(url: URL) {
  const get = (k: string) => url.searchParams.get(k) || undefined;
  return { get };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!verifyAdminKey(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\/admin-api\/?/, "").split("/").filter(Boolean);
  const route = segments[0] || "";
  const subRoute = segments[1] || "";
  const admin = getAdminClient();
  const sp = getSearchParams(url);

  try {
    // ========== GET /admin/payments ==========
    if (route === "admin" && subRoute === "payments" && req.method === "GET") {
      let query = admin
        .from("orders")
        .select("id, order_number, payment_status, order_status, item_price, delivery_fee, total_amount, source, buyer_name, buyer_phone, buyer_role, created_at, product_id, affiliate_id, products(id, name, vendor_id, vendors(id, name))")
        .order("created_at", { ascending: false });

      const status = sp.get("status");
      if (status) query = query.eq("payment_status", status);
      const source = sp.get("source");
      if (source) query = query.eq("source", source);
      const dateFrom = sp.get("dateFrom");
      if (dateFrom) query = query.gte("created_at", dateFrom);
      const dateTo = sp.get("dateTo");
      if (dateTo) query = query.lte("created_at", dateTo);
      const vendorId = sp.get("vendorId");
      if (vendorId) query = query.eq("products.vendor_id", vendorId);
      const affiliateId = sp.get("affiliateId");
      if (affiliateId) query = query.eq("affiliate_id", affiliateId);

      const { data, error } = await query.limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ payments: data });
    }

    // ========== GET /admin/orders ==========
    if (route === "admin" && subRoute === "orders" && req.method === "GET") {
      let query = admin
        .from("orders")
        .select("id, order_number, order_status, payment_status, item_price, delivery_fee, total_amount, source, buyer_name, buyer_phone, buyer_role, buyer_city_id, affiliate_id, product_id, affiliate_rate_at_purchase, created_at, updated_at, products(id, name, vendor_id)")
        .order("created_at", { ascending: false });

      const status = sp.get("status");
      if (status) query = query.eq("order_status", status);
      const source = sp.get("source");
      if (source) query = query.eq("source", source);
      const dateFrom = sp.get("dateFrom");
      if (dateFrom) query = query.gte("created_at", dateFrom);
      const dateTo = sp.get("dateTo");
      if (dateTo) query = query.lte("created_at", dateTo);
      const buyerRole = sp.get("buyerRole");
      if (buyerRole) query = query.eq("buyer_role", buyerRole);

      const { data, error } = await query.limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ orders: data });
    }

    // ========== GET /admin/ledger ==========
    if (route === "admin" && subRoute === "ledger" && req.method === "GET") {
      let query = admin
        .from("order_ledger")
        .select("id, order_id, entry_type, recipient_id, recipient_type, amount, currency, status, payout_id, paid_at, created_at")
        .order("created_at", { ascending: false });

      const status = sp.get("status");
      if (status) query = query.eq("status", status);
      const recipientType = sp.get("recipientType");
      if (recipientType) query = query.eq("recipient_type", recipientType);
      const recipientId = sp.get("recipientId");
      if (recipientId) query = query.eq("recipient_id", recipientId);
      const dateFrom = sp.get("dateFrom");
      if (dateFrom) query = query.gte("created_at", dateFrom);
      const dateTo = sp.get("dateTo");
      if (dateTo) query = query.lte("created_at", dateTo);

      const { data, error } = await query.limit(500);
      if (error) return json({ error: error.message }, 500);
      return json({ ledger: data });
    }

    // ========== GET /admin/payouts ==========
    if (route === "admin" && subRoute === "payouts" && req.method === "GET") {
      let query = admin
        .from("payouts")
        .select("id, recipient_id, recipient_type, payout_account_id, amount, currency, status, provider_reference, notes, idempotency_key, created_at, updated_at")
        .order("created_at", { ascending: false });

      const status = sp.get("status");
      if (status) query = query.eq("status", status);
      const recipientType = sp.get("recipientType");
      if (recipientType) query = query.eq("recipient_type", recipientType);
      const dateFrom = sp.get("dateFrom");
      if (dateFrom) query = query.gte("created_at", dateFrom);
      const dateTo = sp.get("dateTo");
      if (dateTo) query = query.lte("created_at", dateTo);

      const { data, error } = await query.limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ payouts: data });
    }

    // ========== POST /admin/payouts/manual ==========
    if (route === "admin" && subRoute === "payouts" && segments[2] === "manual" && req.method === "POST") {
      const body = await req.json();
      const { recipientType, recipientId, amount, currency, payoutAccountId } = body;

      if (!recipientType || !recipientId || !amount || amount <= 0) {
        return json({ error: "Missing or invalid fields" }, 400);
      }

      // Compute available balance from ledger
      const { data: ledgerLines, error: ledgerErr } = await admin
        .from("order_ledger")
        .select("id, amount")
        .eq("recipient_id", recipientId)
        .eq("recipient_type", recipientType)
        .eq("status", "pending")
        .is("payout_id", null);

      if (ledgerErr) return json({ error: ledgerErr.message }, 500);

      const available = (ledgerLines || []).reduce((sum: number, l: { amount: number }) => sum + Number(l.amount), 0);

      if (amount > available) {
        return json({ error: `Requested ${amount} exceeds available balance ${available}` }, 400);
      }

      // Create idempotency key
      const idempotencyKey = `manual_${recipientId}_${Date.now()}`;

      // Create payout record
      const { data: payout, error: payoutErr } = await admin
        .from("payouts")
        .insert({
          recipient_id: recipientId,
          recipient_type: recipientType,
          payout_account_id: payoutAccountId || null,
          amount,
          currency: currency || "TZS",
          status: "processing",
          idempotency_key: idempotencyKey,
        })
        .select("id")
        .single();

      if (payoutErr) {
        if (payoutErr.message?.includes("duplicate")) {
          return json({ error: "Duplicate payout request" }, 409);
        }
        return json({ error: payoutErr.message }, 500);
      }

      // Mark ledger lines as paid_out up to the payout amount
      let remaining = amount;
      const lineIds: string[] = [];
      for (const line of ledgerLines || []) {
        if (remaining <= 0) break;
        lineIds.push(line.id);
        remaining -= Number(line.amount);
      }

      if (lineIds.length > 0) {
        await admin
          .from("order_ledger")
          .update({ status: "paid_out", payout_id: payout.id, paid_at: new Date().toISOString() })
          .in("id", lineIds);
      }

      // TODO: Call MeetPay payout adapter here
      // const meetpayResult = await createPayout({ recipientId, amount, currency, payoutAccountId });
      // For now, mark as completed (adapter placeholder)
      await admin
        .from("payouts")
        .update({ status: "completed", provider_reference: `manual_${payout.id}` })
        .eq("id", payout.id);

      return json({ payout_id: payout.id, status: "completed", lines_marked: lineIds.length });
    }

    // ========== GET /admin/payout-accounts ==========
    if (route === "admin" && subRoute === "payout-accounts" && req.method === "GET") {
      const recipientId = sp.get("recipientId");
      if (!recipientId) return json({ error: "recipientId required" }, 400);

      const { data, error } = await admin
        .from("payout_accounts")
        .select("*")
        .eq("owner_id", recipientId)
        .order("is_default", { ascending: false });

      if (error) return json({ error: error.message }, 500);
      return json({ accounts: data });
    }

    // ========== PUT /admin/payout-settings ==========
    if (route === "admin" && subRoute === "payout-settings" && req.method === "PUT") {
      const body = await req.json();
      const { enabled, frequency, runHour, minThreshold, holdDays } = body;

      // Get existing settings row
      const { data: existing } = await admin
        .from("payout_settings")
        .select("id")
        .limit(1)
        .single();

      if (!existing) {
        return json({ error: "Payout settings not initialized" }, 500);
      }

      const updates: Record<string, unknown> = {};
      if (typeof enabled === "boolean") updates.enabled = enabled;
      if (frequency) updates.frequency = frequency;
      if (typeof runHour === "number") updates.run_hour = runHour;
      if (typeof minThreshold === "number") updates.min_threshold = minThreshold;
      if (typeof holdDays === "number") updates.hold_days = holdDays;

      const { data, error } = await admin
        .from("payout_settings")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ settings: data });
    }

    // ========== POST /admin/payouts/run-scheduled ==========
    if (route === "admin" && subRoute === "payouts" && segments[2] === "run-scheduled" && req.method === "POST") {
      // Load payout settings
      const { data: settings } = await admin
        .from("payout_settings")
        .select("*")
        .limit(1)
        .single();

      if (!settings || !settings.enabled) {
        return json({ message: "Scheduled payouts disabled", processed: 0 });
      }

      const holdDays = settings.hold_days || 3;
      const minThreshold = settings.min_threshold || 5000;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - holdDays);

      // Find all pending ledger entries older than hold period, not yet paid out
      const { data: eligibleLines, error: eligErr } = await admin
        .from("order_ledger")
        .select("id, recipient_id, recipient_type, amount")
        .eq("status", "pending")
        .is("payout_id", null)
        .lte("created_at", cutoffDate.toISOString())
        .in("recipient_type", ["vendor", "affiliate"])
        .order("recipient_id");

      if (eligErr) return json({ error: eligErr.message }, 500);
      if (!eligibleLines || eligibleLines.length === 0) {
        return json({ message: "No eligible entries", processed: 0 });
      }

      // Group by recipient
      const grouped: Record<string, { recipientType: string; lines: { id: string; amount: number }[]; total: number }> = {};
      for (const line of eligibleLines) {
        const key = `${line.recipient_type}_${line.recipient_id}`;
        if (!grouped[key]) {
          grouped[key] = { recipientType: line.recipient_type, lines: [], total: 0 };
        }
        grouped[key].lines.push({ id: line.id, amount: Number(line.amount) });
        grouped[key].total += Number(line.amount);
      }

      let processed = 0;
      const results: Array<{ recipientId: string; amount: number; status: string }> = [];

      for (const [key, group] of Object.entries(grouped)) {
        if (group.total < minThreshold) continue;

        const recipientId = key.split("_").slice(1).join("_");
        const idempotencyKey = `scheduled_${recipientId}_${cutoffDate.toISOString().slice(0, 10)}`;

        // Check idempotency
        const { data: existingPayout } = await admin
          .from("payouts")
          .select("id")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existingPayout) {
          results.push({ recipientId, amount: group.total, status: "already_processed" });
          continue;
        }

        // Find default payout account
        const { data: account } = await admin
          .from("payout_accounts")
          .select("id")
          .eq("owner_id", recipientId)
          .eq("is_default", true)
          .maybeSingle();

        const { data: payout, error: payoutErr } = await admin
          .from("payouts")
          .insert({
            recipient_id: recipientId,
            recipient_type: group.recipientType,
            payout_account_id: account?.id || null,
            amount: group.total,
            status: "processing",
            idempotency_key: idempotencyKey,
          })
          .select("id")
          .single();

        if (payoutErr) {
          results.push({ recipientId, amount: group.total, status: "error" });
          continue;
        }

        // Mark lines as paid_out
        const lineIds = group.lines.map((l) => l.id);
        await admin
          .from("order_ledger")
          .update({ status: "paid_out", payout_id: payout.id, paid_at: new Date().toISOString() })
          .in("id", lineIds);

        // TODO: Call MeetPay payout adapter
        await admin
          .from("payouts")
          .update({ status: "completed", provider_reference: `scheduled_${payout.id}` })
          .eq("id", payout.id);

        processed++;
        results.push({ recipientId, amount: group.total, status: "completed" });
      }

      return json({ message: "Scheduled payout run complete", processed, results });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Admin API error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
