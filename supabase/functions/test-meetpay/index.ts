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

  // Read-only status lookup for a given payment id: /test-meetpay?payment_id=...
  const paymentId = new URL(req.url).searchParams.get("payment_id");
  if (!paymentId) {
    return new Response(JSON.stringify({ error: "payment_id query param required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const path of [`/payments/${paymentId}`, `/payments/${paymentId}/status`]) {
    try {
      const r = await fetch(`https://meet.briq.tz/api/v1${path}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
          "User-Agent": "AfriLink-Checkout/1.0",
        },
      });
      const body = await r.text();
      results.push({ path, status: r.status, body: body.substring(0, 800) });
    } catch (e: any) {
      results.push({ path, error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
