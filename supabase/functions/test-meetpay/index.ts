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

  // Test with User-Agent header (Cloudflare often blocks without it)
  try {
    const r = await fetch("https://meet.briq.tz/api/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ua-test-${Date.now()}`,
        "User-Agent": "AfriLink-Checkout/1.0",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        amount: 1000,
        currency: "TZS",
        type: "mobile",
        phone: "255759340243",
        network: "VODACOM",
        customer: { firstname: "Test", lastname: "User", email: "test@test.com" },
        reference: `TEST-UA-${Date.now()}`,
      }),
    });
    const body = await r.text();
    results.push({ test: "POST with User-Agent", status: r.status, body: body.substring(0, 500) });
  } catch (e: any) {
    results.push({ test: "POST with User-Agent", error: e.message });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
