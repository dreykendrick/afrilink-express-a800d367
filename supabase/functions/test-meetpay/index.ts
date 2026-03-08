import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("MEETPAY_API_KEY");
  const results: any[] = [];

  // Test 1: Simple GET to check connectivity
  try {
    const r1 = await fetch("https://meet.briq.tz/api/v1/payments", {
      method: "GET",
    });
    results.push({ test: "GET /payments (no auth)", status: r1.status, body: await r1.text().then(t => t.substring(0, 200)) });
  } catch (e: any) {
    results.push({ test: "GET /payments (no auth)", error: e.message });
  }

  // Test 2: POST with auth
  try {
    const r2 = await fetch("https://meet.briq.tz/api/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${Date.now()}`,
      },
      body: JSON.stringify({
        amount: 1000,
        currency: "TZS",
        type: "mobile",
        phone: "255759340243",
        network: "VODACOM",
        customer: { firstname: "Test", lastname: "User", email: "test@test.com" },
        reference: `TEST-${Date.now()}`,
      }),
    });
    const body = await r2.text();
    results.push({ test: "POST /payments (with auth)", status: r2.status, body: body.substring(0, 500) });
  } catch (e: any) {
    results.push({ test: "POST /payments (with auth)", error: e.message });
  }

  return new Response(JSON.stringify({ results, apiKeyPresent: !!apiKey, apiKeyLength: apiKey?.length }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
