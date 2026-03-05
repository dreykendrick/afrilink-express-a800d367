import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
};

// ── Briq Payout Adapter ──────────────────────────────────────────────

const BRIQ_BASE_URL = "https://api.briq.tz";
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getBriqToken(): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const apiKey = Deno.env.get("BRIQ_API_KEY");
  const apiSecret = Deno.env.get("BRIQ_API_SECRET");
  if (!apiKey || !apiSecret) {
    throw new Error("BRIQ_API_KEY or BRIQ_API_SECRET not configured");
  }

  const credentials = btoa(`${apiKey}:${apiSecret}`);
  const res = await fetch(`${BRIQ_BASE_URL}/auth`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Briq auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  // Cache for ~47 hours (assuming ~48h validity)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 47 * 60 * 60 * 1000,
  };
  return data.access_token;
}

interface BriqPayoutRequest {
  amount: number;
  currency: string;
  recipientName: string;
  accountNumber: string;
  bankCode: string;
  reference: string;
  description: string;
}

interface BriqPayoutResponse {
  status: string;
  reference: string;
  transaction_id: string;
  created_at: string;
}

async function createBriqPayout(params: BriqPayoutRequest): Promise<BriqPayoutResponse> {
  const token = await getBriqToken();

  const res = await fetch(`${BRIQ_BASE_URL}/v1/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      recipient: {
        name: params.recipientName,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
      },
      reference: params.reference,
      description: params.description,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // If auth expired, clear cache and retry once
    if (res.status === 401 && cachedToken) {
      cachedToken = null;
      return createBriqPayout(params);
    }
    throw new Error(`Briq payout failed (${res.status}): ${body}`);
  }

  return await res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────

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

/** Look up payout account details for a recipient to get name, number, and bank code */
async function getPayoutAccountDetails(admin: ReturnType<typeof getAdminClient>, recipientId: string, payoutAccountId?: string | null) {
  let query = admin.from("payout_accounts").select("*").eq("owner_id", recipientId);

  if (payoutAccountId) {
    query = query.eq("id", payoutAccountId);
  } else {
    query = query.eq("is_default", true);
  }

  const { data } = await query.maybeSingle();
  return data;
}

// ── Main Handler ─────────────────────────────────────────────────────

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

      // Look up payout account for recipient details
      const account = await getPayoutAccountDetails(admin, recipientId, payoutAccountId);

      // Create payout record
      const { data: payout, error: payoutErr } = await admin
        .from("payouts")
        .insert({
          recipient_id: recipientId,
          recipient_type: recipientType,
          payout_account_id: account?.id || payoutAccountId || null,
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

      // Call Briq payout API
      let briqResult: BriqPayoutResponse | null = null;
      let payoutStatus = "completed";
      let providerRef: string | null = null;
      let payoutNotes: string | null = null;

      if (account) {
        try {
          const reference = `afrilink_manual_${payout.id}`;
          briqResult = await createBriqPayout({
            amount,
            currency: currency || "TZS",
            recipientName: account.account_name || "Recipient",
            accountNumber: account.account_number,
            bankCode: account.provider || "MPESA",
            reference,
            description: `Manual payout for ${recipientType} ${recipientId}`,
          });
          payoutStatus = briqResult.status === "processing" ? "processing" : briqResult.status;
          providerRef = briqResult.transaction_id;
        } catch (err) {
          console.error("Briq payout error:", err);
          payoutStatus = "failed";
          payoutNotes = `Briq API error: ${(err as Error).message}`;
        }
      } else {
        payoutStatus = "failed";
        payoutNotes = "No payout account found for recipient";
      }

      await admin
        .from("payouts")
        .update({ status: payoutStatus, provider_reference: providerRef, notes: payoutNotes })
        .eq("id", payout.id);

      // If payout failed, revert ledger lines back to pending
      if (payoutStatus === "failed" && lineIds.length > 0) {
        await admin
          .from("order_ledger")
          .update({ status: "pending", payout_id: null, paid_at: null })
          .in("id", lineIds);
      }

      return json({
        payout_id: payout.id,
        status: payoutStatus,
        provider_reference: providerRef,
        lines_marked: payoutStatus === "failed" ? 0 : lineIds.length,
        error: payoutNotes,
      });
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
      const results: Array<{ recipientId: string; amount: number; status: string; provider_reference?: string; error?: string }> = [];

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
        const account = await getPayoutAccountDetails(admin, recipientId);

        if (!account) {
          results.push({ recipientId, amount: group.total, status: "skipped", error: "No payout account configured" });
          continue;
        }

        const { data: payout, error: payoutErr } = await admin
          .from("payouts")
          .insert({
            recipient_id: recipientId,
            recipient_type: group.recipientType,
            payout_account_id: account.id,
            amount: group.total,
            status: "processing",
            idempotency_key: idempotencyKey,
          })
          .select("id")
          .single();

        if (payoutErr) {
          results.push({ recipientId, amount: group.total, status: "error", error: payoutErr.message });
          continue;
        }

        // Mark lines as paid_out
        const lineIds = group.lines.map((l) => l.id);
        await admin
          .from("order_ledger")
          .update({ status: "paid_out", payout_id: payout.id, paid_at: new Date().toISOString() })
          .in("id", lineIds);

        // Call Briq payout API
        let payoutStatus = "completed";
        let providerRef: string | null = null;
        let payoutNotes: string | null = null;

        try {
          const reference = `afrilink_scheduled_${payout.id}`;
          const briqResult = await createBriqPayout({
            amount: group.total,
            currency: "TZS",
            recipientName: account.account_name || "Recipient",
            accountNumber: account.account_number,
            bankCode: account.provider || "MPESA",
            reference,
            description: `Scheduled payout for ${group.recipientType} ${recipientId}`,
          });
          payoutStatus = briqResult.status === "processing" ? "processing" : briqResult.status;
          providerRef = briqResult.transaction_id;
        } catch (err) {
          console.error("Briq scheduled payout error:", err);
          payoutStatus = "failed";
          payoutNotes = `Briq API error: ${(err as Error).message}`;

          // Revert ledger lines on failure
          await admin
            .from("order_ledger")
            .update({ status: "pending", payout_id: null, paid_at: null })
            .in("id", lineIds);
        }

        await admin
          .from("payouts")
          .update({ status: payoutStatus, provider_reference: providerRef, notes: payoutNotes })
          .eq("id", payout.id);

        if (payoutStatus !== "failed") processed++;
        results.push({ recipientId, amount: group.total, status: payoutStatus, provider_reference: providerRef || undefined, error: payoutNotes || undefined });
      }

      return json({ message: "Scheduled payout run complete", processed, results });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Admin API error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
