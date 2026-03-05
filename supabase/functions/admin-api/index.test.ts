import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ADMIN_API_KEY = Deno.env.get("ADMIN_API_KEY");

const BASE = `${SUPABASE_URL}/functions/v1/admin-api/admin/payouts`;

Deno.test("manual payout rejects without admin key", async () => {
  const res = await fetch(`${BASE}/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipientType: "vendor", recipientId: "00000000-0000-0000-0000-000000000000", amount: 1000 }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("manual payout rejects missing fields", async () => {
  if (!ADMIN_API_KEY) {
    console.log("ADMIN_API_KEY not set locally, skipping");
    return;
  }
  const res = await fetch(`${BASE}/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_API_KEY },
    body: JSON.stringify({ recipientType: "vendor" }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  await res.body?.cancel().catch(() => {});
});

Deno.test("manual payout rejects insufficient balance", async () => {
  if (!ADMIN_API_KEY) {
    console.log("ADMIN_API_KEY not set locally, skipping");
    return;
  }
  const res = await fetch(`${BASE}/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_API_KEY },
    body: JSON.stringify({
      recipientType: "vendor",
      recipientId: "00000000-0000-0000-0000-000000000000",
      amount: 1000,
      currency: "TZS",
    }),
  });
  const body = await res.json();
  // Should fail because there are no pending ledger entries for this fake recipient
  assertEquals(res.status, 400);
  assertEquals(body.error, "Requested 1000 exceeds available balance 0");
});
