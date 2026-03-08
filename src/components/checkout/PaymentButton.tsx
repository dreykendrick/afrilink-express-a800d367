import { useState, useRef } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createCheckout } from '@/lib/api';
import { formatPrice, normalizePhone, isValidTanzaniaPhone, generateIdempotencyKey } from '@/lib/format';
import type { Product, BuyerInfo, CheckoutSource, BuyerRole } from '@/lib/types';

interface PaymentButtonProps {
  product: Product;
  buyerInfo: BuyerInfo;
  deliveryFee: number;
  totalAmount: number;
  isWithinRange: boolean;
  onSuccess: (orderId: string) => void;
  source?: CheckoutSource;
  buyerUserId?: string | null;
  buyerRole?: BuyerRole;
}

export function PaymentButton({
  product,
  buyerInfo,
  deliveryFee,
  totalAmount,
  isWithinRange,
  onSuccess,
  source = 'affiliate_link',
  buyerUserId = null,
  buyerRole = 'guest',
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const { toast } = useToast();

  const validateForm = (): string | null => {
    if (!buyerInfo.name.trim()) return 'Please enter your full name';
    if (!buyerInfo.phone.trim()) return 'Please enter your phone number';
    if (!isValidTanzaniaPhone(buyerInfo.phone)) return 'Please enter a valid Tanzania phone number';
    if (!buyerInfo.delivery_address.trim()) return 'Please enter your delivery address';
    if (!isWithinRange) return 'Delivery is not available to your location';
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
      const affiliateRef = source === 'affiliate_link'
        ? (sessionStorage.getItem('afrilink_affiliate') || null)
        : null;

      const result = await createCheckout({
        product_id: product.id,
        customer_name: buyerInfo.name.trim(),
        customer_phone: normalizePhone(buyerInfo.phone),
        delivery_address: buyerInfo.delivery_address.trim(),
        delivery_lat: buyerInfo.delivery_lat,
        delivery_lng: buyerInfo.delivery_lng,
        customer_landmark: buyerInfo.landmark.trim() || undefined,
        customer_notes: buyerInfo.notes.trim() || undefined,
        source,
        buyer_user_id: buyerUserId,
        buyer_role: buyerRole,
        affiliate_ref: affiliateRef,
        checkout_session_id: idempotencyKeyRef.current!,
      });

      if (result.payment_url) {
        window.location.href = result.payment_url;
        return;
      }

      // For mobile money STK push: payment was initiated successfully
      // The user will receive a push notification on their phone to confirm
      toast({
        title: 'Payment request sent!',
        description: 'Please check your phone and confirm the mobile money payment.',
      });
      onSuccess(result.order_id);
    } catch (err: any) {
      console.error('Payment error:', err);
      const errorMessage = err?.message || 'Something went wrong. Please try again.';
      toast({ variant: 'destructive', title: 'Payment failed', description: errorMessage });
      idempotencyKeyRef.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || totalAmount === 0 || !isWithinRange;

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
        ) : !isWithinRange ? (
          'Delivery not available'
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
