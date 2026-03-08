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

    // ========== GET /admin/delivery-settings ==========
    if (route === "admin" && subRoute === "delivery-settings" && req.method === "GET") {
      const { data, error } = await admin
        .from("delivery_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);

      // Return defaults if no row exists
      const settings = data || {
        enabled: true,
        base_fee: 1500,
        price_per_km: 500,
        minimum_fee: 1500,
        maximum_fee: null,
        free_delivery_threshold: null,
        max_delivery_distance_km: null,
      };

      return json({ settings });
    }

    // ========== PUT /admin/delivery-settings ==========
    if (route === "admin" && subRoute === "delivery-settings" && req.method === "PUT") {
      const body = await req.json();
      const {
        enabled,
        base_fee,
        price_per_km,
        minimum_fee,
        maximum_fee,
        free_delivery_threshold,
        max_delivery_distance_km,
      } = body;

      // Validation
      const errors: string[] = [];
      if (base_fee !== undefined && (typeof base_fee !== "number" || base_fee < 0))
        errors.push("base_fee must be a number >= 0");
      if (price_per_km !== undefined && (typeof price_per_km !== "number" || price_per_km < 0))
        errors.push("price_per_km must be a number >= 0");
      if (minimum_fee !== undefined && (typeof minimum_fee !== "number" || minimum_fee < 0))
        errors.push("minimum_fee must be a number >= 0");
      if (maximum_fee !== undefined && maximum_fee !== null) {
        if (typeof maximum_fee !== "number" || maximum_fee < 0)
          errors.push("maximum_fee must be null or a number >= 0");
        const effectiveMin = minimum_fee ?? body._current_minimum_fee ?? 0;
        if (typeof maximum_fee === "number" && typeof effectiveMin === "number" && maximum_fee < effectiveMin)
          errors.push("maximum_fee must be >= minimum_fee");
      }
      if (free_delivery_threshold !== undefined && free_delivery_threshold !== null) {
        if (typeof free_delivery_threshold !== "number" || free_delivery_threshold < 0)
          errors.push("free_delivery_threshold must be null or a number >= 0");
      }
      if (max_delivery_distance_km !== undefined && max_delivery_distance_km !== null) {
        if (typeof max_delivery_distance_km !== "number" || max_delivery_distance_km <= 0)
          errors.push("max_delivery_distance_km must be null or a number > 0");
      }

      if (errors.length > 0) {
        return json({ error: "Validation failed", details: errors }, 400);
      }

      // Build update object
      const updates: Record<string, unknown> = {};
      if (typeof enabled === "boolean") updates.enabled = enabled;
      if (base_fee !== undefined) updates.base_fee = base_fee;
      if (price_per_km !== undefined) updates.price_per_km = price_per_km;
      if (minimum_fee !== undefined) updates.minimum_fee = minimum_fee;
      if (maximum_fee !== undefined) updates.maximum_fee = maximum_fee;
      if (free_delivery_threshold !== undefined) updates.free_delivery_threshold = free_delivery_threshold;
      if (max_delivery_distance_km !== undefined) updates.max_delivery_distance_km = max_delivery_distance_km;

      if (Object.keys(updates).length === 0) {
        return json({ error: "No fields to update" }, 400);
      }

      // Get existing row (upsert pattern)
      const { data: existing } = await admin
        .from("delivery_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      let data;
      let error;

      if (existing) {
        // Cross-validate maximum_fee >= minimum_fee using current DB value
        if (updates.maximum_fee !== undefined && updates.maximum_fee !== null && updates.minimum_fee === undefined) {
          const { data: current } = await admin
            .from("delivery_settings")
            .select("minimum_fee")
            .eq("id", existing.id)
            .single();
          if (current && typeof updates.maximum_fee === "number" && updates.maximum_fee < current.minimum_fee) {
            return json({ error: "maximum_fee must be >= current minimum_fee (" + current.minimum_fee + ")" }, 400);
          }
        }

        const result = await admin
          .from("delivery_settings")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        const result = await admin
          .from("delivery_settings")
          .insert({
            enabled: true,
            base_fee: 1500,
            price_per_km: 500,
            minimum_fee: 1500,
            ...updates,
          })
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) return json({ error: error.message }, 500);
      return json({ settings: data });
    }

    // ========== GET /admin/wallets ==========
    if (route === "admin" && subRoute === "wallets" && req.method === "GET") {
      let query = admin
        .from("wallets")
        .select("id, owner_id, owner_type, balance, total_earned, total_withdrawn, currency, created_at, updated_at")
        .order("updated_at", { ascending: false });

      const ownerType = sp.get("ownerType");
      if (ownerType) query = query.eq("owner_type", ownerType);
      const ownerId = sp.get("ownerId");
      if (ownerId) query = query.eq("owner_id", ownerId);

      const { data, error } = await query.limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ wallets: data });
    }

    // ========== GET /admin/wallets/:id/transactions ==========
    if (route === "admin" && subRoute === "wallets" && segments[2] && segments[3] === "transactions" && req.method === "GET") {
      const walletId = segments[2];
      const { data, error } = await admin
        .from("wallet_transactions")
        .select("id, wallet_id, order_id, withdrawal_id, type, amount, description, created_at")
        .eq("wallet_id", walletId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) return json({ error: error.message }, 500);
      return json({ transactions: data });
    }

    // ========== POST /admin/withdrawals/request ==========
    if (route === "admin" && subRoute === "withdrawals" && segments[2] === "request" && req.method === "POST") {
      const body = await req.json();
      const { ownerId, ownerType, amount, method, phoneNumber } = body;

      if (!ownerId || !ownerType || !amount || !phoneNumber) {
        return json({ error: "Missing required fields: ownerId, ownerType, amount, phoneNumber" }, 400);
      }

      const WITHDRAWAL_FEE = 2000;
      const MIN_WITHDRAWAL = 20000;

      if (amount < MIN_WITHDRAWAL) {
        return json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} TZS` }, 400);
      }

      // Get wallet
      const { data: wallet, error: walletErr } = await admin
        .from("wallets")
        .select("id, balance")
        .eq("owner_id", ownerId)
        .eq("owner_type", ownerType)
        .single();

      if (walletErr || !wallet) {
        return json({ error: "Wallet not found" }, 404);
      }

      if (wallet.balance < amount) {
        return json({ error: `Insufficient balance. Available: ${wallet.balance} TZS, Requested: ${amount} TZS` }, 400);
      }

      const netAmount = amount - WITHDRAWAL_FEE;
      if (netAmount <= 0) {
        return json({ error: `Amount must be greater than withdrawal fee (${WITHDRAWAL_FEE} TZS)` }, 400);
      }

      // Create withdrawal record
      const { data: withdrawal, error: wdErr } = await admin
        .from("withdrawals")
        .insert({
          wallet_id: wallet.id,
          owner_id: ownerId,
          owner_type: ownerType,
          amount,
          fee: WITHDRAWAL_FEE,
          net_amount: netAmount,
          method: method || "mobile_money",
          phone_number: phoneNumber,
          status: "pending",
        })
        .select("id")
        .single();

      if (wdErr) {
        console.error("Withdrawal creation error:", wdErr);
        return json({ error: "Failed to create withdrawal" }, 500);
      }

      // Deduct from wallet balance immediately
      await admin
        .from("wallets")
        .update({
          balance: wallet.balance - amount,
          total_withdrawn: (wallet as any).total_withdrawn
            ? Number((wallet as any).total_withdrawn) + amount
            : amount,
        })
        .eq("id", wallet.id);

      // Record debit transaction
      await admin.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        withdrawal_id: withdrawal.id,
        type: "debit",
        amount,
        description: `Withdrawal request #${withdrawal.id.slice(0, 8)} (fee: ${WITHDRAWAL_FEE} TZS)`,
      });

      return json({
        withdrawal_id: withdrawal.id,
        amount,
        fee: WITHDRAWAL_FEE,
        net_amount: netAmount,
        status: "pending",
      }, 201);
    }

    // ========== POST /admin/withdrawals/process ==========
    if (route === "admin" && subRoute === "withdrawals" && segments[2] === "process" && req.method === "POST") {
      const body = await req.json();
      const { withdrawalId } = body;

      if (!withdrawalId) {
        return json({ error: "Missing withdrawalId" }, 400);
      }

      const { data: wd, error: wdErr } = await admin
        .from("withdrawals")
        .select("*, wallets(owner_id, owner_type)")
        .eq("id", withdrawalId)
        .single();

      if (wdErr || !wd) {
        return json({ error: "Withdrawal not found" }, 404);
      }

      if (wd.status !== "pending") {
        return json({ error: `Withdrawal is already ${wd.status}` }, 400);
      }

      // Update to processing
      await admin.from("withdrawals").update({ status: "processing" }).eq("id", withdrawalId);

      // Look up payout account
      const account = await getPayoutAccountDetails(admin, wd.owner_id);

      let providerRef: string | null = null;
      let finalStatus = "completed";
      let failureReason: string | null = null;

      if (account) {
        try {
          const reference = `afrilink_withdrawal_${withdrawalId}`;
          const briqResult = await createBriqPayout({
            amount: wd.net_amount,
            currency: "TZS",
            recipientName: account.account_name || "Recipient",
            accountNumber: account.account_number || wd.phone_number,
            bankCode: account.provider || "MPESA",
            reference,
            description: `Withdrawal for ${wd.owner_type} ${wd.owner_id}`,
          });
          providerRef = briqResult.transaction_id;
          finalStatus = briqResult.status === "processing" ? "processing" : "completed";
        } catch (err) {
          console.error("Withdrawal payout error:", err);
          finalStatus = "failed";
          failureReason = (err as Error).message;
        }
      } else {
        // No payout account — try using the phone number directly
        try {
          const reference = `afrilink_withdrawal_${withdrawalId}`;
          const briqResult = await createBriqPayout({
            amount: wd.net_amount,
            currency: "TZS",
            recipientName: wd.owner_type,
            accountNumber: wd.phone_number,
            bankCode: "MPESA",
            reference,
            description: `Withdrawal for ${wd.owner_type} ${wd.owner_id}`,
          });
          providerRef = briqResult.transaction_id;
          finalStatus = briqResult.status === "processing" ? "processing" : "completed";
        } catch (err) {
          console.error("Withdrawal payout error (direct):", err);
          finalStatus = "failed";
          failureReason = (err as Error).message;
        }
      }

      // Update withdrawal status
      await admin.from("withdrawals").update({
        status: finalStatus,
        provider_reference: providerRef,
        failure_reason: failureReason,
        processed_at: finalStatus !== "failed" ? new Date().toISOString() : null,
      }).eq("id", withdrawalId);

      // If failed, refund wallet balance
      if (finalStatus === "failed") {
        const { data: wallet } = await admin
          .from("wallets")
          .select("id, balance, total_withdrawn")
          .eq("owner_id", wd.owner_id)
          .eq("owner_type", wd.owner_type)
          .single();

        if (wallet) {
          await admin.from("wallets").update({
            balance: Number(wallet.balance) + Number(wd.amount),
            total_withdrawn: Math.max(0, Number(wallet.total_withdrawn) - Number(wd.amount)),
          }).eq("id", wallet.id);

          await admin.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            withdrawal_id: withdrawalId,
            type: "credit",
            amount: wd.amount,
            description: `Refund for failed withdrawal #${withdrawalId.slice(0, 8)}`,
          });
        }
      }

      return json({
        withdrawal_id: withdrawalId,
        status: finalStatus,
        provider_reference: providerRef,
        failure_reason: failureReason,
      });
    }

    // ========== GET /admin/withdrawals ==========
    if (route === "admin" && subRoute === "withdrawals" && !segments[2] && req.method === "GET") {
      let query = admin
        .from("withdrawals")
        .select("id, wallet_id, owner_id, owner_type, amount, fee, net_amount, method, phone_number, status, provider_reference, failure_reason, processed_at, created_at")
        .order("created_at", { ascending: false });

      const status = sp.get("status");
      if (status) query = query.eq("status", status);
      const ownerType = sp.get("ownerType");
      if (ownerType) query = query.eq("owner_type", ownerType);
      const ownerId = sp.get("ownerId");
      if (ownerId) query = query.eq("owner_id", ownerId);

      const { data, error } = await query.limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ withdrawals: data });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Admin API error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
