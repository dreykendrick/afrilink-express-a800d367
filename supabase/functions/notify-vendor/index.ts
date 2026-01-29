import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyVendorRequest {
  orderId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const BRIQ_API_KEY = Deno.env.get("BRIQ_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase configuration");
      throw new Error("Server configuration error");
    }

    if (!BRIQ_API_KEY) {
      console.error("BRIQ_API_KEY is not configured");
      throw new Error("SMS service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { orderId }: NotifyVendorRequest = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "orderId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing vendor notification for order: ${orderId}`);

    // Fetch order with product and vendor details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        product:products(
          name,
          vendor:vendors(name, phone)
        ),
        buyer_city:cities(name)
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already notified (idempotency)
    if (order.vendor_notified_at) {
      console.log(`Vendor already notified for order ${orderId}`);
      return new Response(
        JSON.stringify({ success: true, message: "Already notified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check payment status
    if (order.payment_status !== "confirmed") {
      console.log(`Payment not confirmed for order ${orderId}`);
      return new Response(
        JSON.stringify({ error: "Payment not confirmed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vendor = order.product?.vendor;
    if (!vendor?.phone) {
      console.error(`No vendor phone for order ${orderId}`);
      return new Response(
        JSON.stringify({ error: "Vendor phone not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format SMS message
    const message = `📦 NEW ORDER #${order.order_number}

${order.product?.name || "Product"}

📍 Deliver to:
${order.buyer_name}
${order.buyer_phone}
${order.buyer_area}${order.buyer_landmark ? `, ${order.buyer_landmark}` : ""}
${order.buyer_city?.name || ""}

💰 Total: TZS ${Number(order.total_amount).toLocaleString()}
(Delivery: TZS ${Number(order.delivery_fee).toLocaleString()})

⏰ ${new Date(order.created_at).toLocaleString("en-TZ")}`;

    console.log(`Sending SMS to vendor: ${vendor.phone}`);

    // Send SMS via Briq
    const smsResponse = await fetch("https://api.briq.tz/v1/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BRIQ_API_KEY}`,
      },
      body: JSON.stringify({
        to: vendor.phone,
        message: message,
        sender_id: "AFRILINK",
      }),
    });

    const smsResult = await smsResponse.json();
    console.log("Briq SMS response:", smsResult);

    if (!smsResponse.ok) {
      console.error("SMS send failed:", smsResult);
      
      // Update notification status to failed
      await supabase
        .from("orders")
        .update({ notification_status: "failed" })
        .eq("id", orderId);

      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: smsResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update order with notification timestamp
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        vendor_notified_at: new Date().toISOString(),
        notification_status: "sent",
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Failed to update notification status:", updateError);
    }

    console.log(`Vendor notified successfully for order ${orderId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Vendor notified" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Notify vendor error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
