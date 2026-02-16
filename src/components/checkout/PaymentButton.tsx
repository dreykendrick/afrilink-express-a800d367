import { useState, useRef } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice, normalizePhone, isValidTanzaniaPhone, generateIdempotencyKey } from '@/lib/format';
import type { Product, BuyerInfo } from '@/lib/types';

interface PaymentButtonProps {
  product: Product;
  buyerInfo: BuyerInfo;
  deliveryFee: number;
  totalAmount: number;
  onSuccess: (orderId: string) => void;
}

export function PaymentButton({
  product,
  buyerInfo,
  deliveryFee,
  totalAmount,
  onSuccess,
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const { toast } = useToast();

  const validateForm = (): string | null => {
    if (!buyerInfo.name.trim()) return 'Please enter your full name';
    if (!buyerInfo.email.trim()) return 'Please enter your email';
    if (!buyerInfo.phone.trim()) return 'Please enter your phone number';
    if (!isValidTanzaniaPhone(buyerInfo.phone)) return 'Please enter a valid Tanzania phone number';
    if (!buyerInfo.city.trim()) return 'Please enter your city';
    if (!buyerInfo.area.trim()) return 'Please enter your area or street';
    return null;
  };

  const handlePayment = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({ variant: 'destructive', title: 'Missing information', description: validationError });
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }

    setIsLoading(true);

    try {
      // Get affiliate link from session
      const affiliateCode = sessionStorage.getItem('afrilink_affiliate');
      let affiliateLinkId: string | null = null;

      if (affiliateCode) {
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('id')
          .eq('code', affiliateCode)
          .eq('is_active', true)
          .maybeSingle();
        affiliateLinkId = affiliate?.id || null;
      }

      // Build delivery address
      const deliveryAddress = [
        buyerInfo.area.trim(),
        buyerInfo.landmark.trim(),
      ].filter(Boolean).join(', ');

      // Create order
      const { data: order, error: orderError } = await (supabase as any)
        .from('orders')
        .insert({
          customer_name: buyerInfo.name.trim(),
          customer_email: buyerInfo.email.trim(),
          customer_phone: normalizePhone(buyerInfo.phone),
          delivery_address: deliveryAddress || null,
          delivery_city: buyerInfo.city.trim(),
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          status: 'pending',
          payment_status: 'pending_payment',
          affiliate_link_id: affiliateLinkId,
          buyer_notes: buyerInfo.notes.trim() || null,
          checkout_session_id: idempotencyKeyRef.current,
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        throw new Error('Failed to create order');
      }

      // Create order item
      const { error: itemError } = await (supabase as any)
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: product.id,
          quantity: 1,
          price: product.price,
          commission_amount: product.commission || 0,
        });

      if (itemError) {
        console.error('Order item creation error:', itemError);
        // Don't throw - order is created, item is secondary
      }

      // Simulate payment confirmation (in production: mobile money API)
      const { error: updateError } = await (supabase as any)
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'paid',
        })
        .eq('id', order.id);

      if (updateError) {
        console.error('Payment update error:', updateError);
        throw new Error('Payment processing failed');
      }

      // Trigger vendor notification (async)
      supabase.functions.invoke('notify-vendor', {
        body: { orderId: order.id },
      }).catch((err) => console.error('Vendor notification failed:', err));

      toast({ title: 'Payment successful!', description: 'Your order has been placed.' });
      onSuccess(order.id);
    } catch (err) {
      console.error('Payment error:', err);
      toast({ variant: 'destructive', title: 'Payment failed', description: 'Something went wrong. Please try again.' });
      idempotencyKeyRef.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || totalAmount === 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border safe-bottom">
      <Button
        onClick={handlePayment}
        disabled={isDisabled}
        className="w-full h-14 text-lg font-semibold btn-glow"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5 mr-2" />
            Pay {formatPrice(totalAmount)}
          </>
        )}
      </Button>
    </div>
  );
}
