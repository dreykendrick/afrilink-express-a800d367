import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_PRODUCT_FIELDS =
  "id, vendor_id, slug, name, price, description, short_description, images, is_active, created_at, updated_at";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Path: /checkout-api/<route>/<param>
    const segments = url.pathname.replace(/^\/checkout-api\/?/, "").split("/").filter(Boolean);
    const route = segments[0] || "";
    const param = segments[1] || "";

    // ---- GET /products/:idOrSlug ----
    if (route === "products" && param && req.method === "GET") {
      const admin = getAdminClient();
      const isUUID = UUID_REGEX.test(param);
      const column = isUUID ? "id" : "slug";

      const { data, error } = await admin
        .from("products")
        .select(PUBLIC_PRODUCT_FIELDS)
        .eq(column, param)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Product lookup error:", error);
        return json({ error: "Unable to load product" }, 500);
      }
      if (!data) {
        return json({ error: "Product not found" }, 404);
      }
      return json(data);
    }

    // ---- GET /affiliates/:code ----
    if (route === "affiliates" && param && req.method === "GET") {
      const admin = getAdminClient();
      const { data, error } = await admin
        .from("affiliates")
        .select("id, code, name, commission_rate")
        .eq("code", param)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Affiliate lookup error:", error);
        return json({ error: "Unable to load affiliate" }, 500);
      }
      if (!data) {
        return json({ error: "Affiliate not found" }, 404);
      }
      return json(data);
    }

    // ---- POST /affiliate-clicks or /track-click ----
    if ((route === "affiliate-clicks" || route === "track-click") && req.method === "POST") {
      const body = await req.json();
      let { affiliate_id, product_id, session_id, affiliate_code } = body;

      if (!product_id || !session_id) {
        return json({ error: "Missing required fields" }, 400);
      }

      const admin = getAdminClient();

      // If affiliate_code provided instead of affiliate_id, resolve it
      if (!affiliate_id && affiliate_code) {
        const { data: aff } = await admin
          .from("affiliates")
          .select("id")
          .eq("code", affiliate_code)
          .eq("is_active", true)
          .maybeSingle();
        if (aff) affiliate_id = aff.id;
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

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
