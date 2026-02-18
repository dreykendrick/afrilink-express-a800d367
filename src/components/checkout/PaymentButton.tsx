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
    if (!buyerInfo.phone.trim()) return 'Please enter your phone number';
    if (!isValidTanzaniaPhone(buyerInfo.phone)) return 'Please enter a valid Tanzania phone number';
    if (!buyerInfo.city.trim()) return 'Please select your city';
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
      // Get affiliate from session
      const affiliateCode = sessionStorage.getItem('afrilink_affiliate');
      let affiliateId: string | null = null;

      if (affiliateCode) {
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('id')
          .eq('code', affiliateCode)
          .eq('is_active', true)
          .maybeSingle();
        affiliateId = affiliate?.id || null;
      }

      // Generate order number
      const orderNumber = `AF-${Date.now().toString(36).toUpperCase()}`;

      // Create order matching actual DB schema
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          product_id: product.id,
          order_number: orderNumber,
          buyer_name: buyerInfo.name.trim(),
          buyer_phone: normalizePhone(buyerInfo.phone),
          buyer_city_id: buyerInfo.city.trim(),
          buyer_area: buyerInfo.area.trim(),
          buyer_landmark: buyerInfo.landmark.trim() || null,
          buyer_notes: buyerInfo.notes.trim() || null,
          item_price: product.price,
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          affiliate_id: affiliateId,
          payment_status: 'pending',
          order_status: 'pending_payment',
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        throw new Error('Failed to create order');
      }

      // Simulate payment confirmation (in production: mobile money API)
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          order_status: 'paid',
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
