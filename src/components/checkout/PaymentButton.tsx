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
  selectedZoneId?: string;
  onSuccess: (orderId: string) => void;
}

export function PaymentButton({
  product,
  buyerInfo,
  deliveryFee,
  totalAmount,
  selectedZoneId,
  onSuccess,
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const { toast } = useToast();

  const validateForm = (): string | null => {
    if (!buyerInfo.name.trim()) {
      return 'Please enter your full name';
    }
    if (!buyerInfo.phone.trim()) {
      return 'Please enter your phone number';
    }
    if (!isValidTanzaniaPhone(buyerInfo.phone)) {
      return 'Please enter a valid Tanzania phone number';
    }
    if (!buyerInfo.cityId) {
      return 'Please select your city';
    }
    if (!buyerInfo.area.trim()) {
      return 'Please enter your area or street';
    }
    if (deliveryFee === 0 && !selectedZoneId) {
      return 'Please select a delivery zone';
    }
    return null;
  };

  const handlePayment = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: validationError,
      });
      return;
    }

    // Generate idempotency key if not already set
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
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          product_id: product.id,
          affiliate_id: affiliateId,
          buyer_name: buyerInfo.name.trim(),
          buyer_phone: normalizePhone(buyerInfo.phone),
          buyer_city_id: buyerInfo.cityId,
          buyer_area: buyerInfo.area.trim(),
          buyer_landmark: buyerInfo.landmark.trim() || null,
          buyer_notes: buyerInfo.notes.trim() || null,
          item_price: product.price,
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          payment_status: 'pending',
          order_status: 'pending_payment',
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        throw new Error('Failed to create order');
      }

      // For demo: simulate payment confirmation
      // In production, integrate with mobile money API
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'confirmed',
          order_status: 'paid',
        })
        .eq('id', order.id);

      if (updateError) {
        console.error('Payment update error:', updateError);
        throw new Error('Payment processing failed');
      }

      // Trigger vendor notification (async, don't block)
      supabase.functions.invoke('notify-vendor', {
        body: { orderId: order.id },
      }).catch((err) => {
        console.error('Vendor notification failed:', err);
      });

      // Success - navigate to receipt
      toast({
        title: 'Payment successful!',
        description: 'Your order has been placed.',
      });

      onSuccess(order.id);
    } catch (err) {
      console.error('Payment error:', err);
      toast({
        variant: 'destructive',
        title: 'Payment failed',
        description: 'Something went wrong. Please try again.',
      });
      // Reset idempotency key on failure so user can retry
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
