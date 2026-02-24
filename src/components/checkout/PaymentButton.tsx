import { useState, useRef } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createOrder, confirmPayment } from '@/lib/api';
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
      const affiliateCode = sessionStorage.getItem('afrilink_affiliate') || undefined;

      // Create order via remote API
      const order = await createOrder({
        product_id: product.id,
        customer_name: buyerInfo.name.trim(),
        customer_phone: normalizePhone(buyerInfo.phone),
        customer_city_id: buyerInfo.city.trim(),
        customer_area: buyerInfo.area.trim(),
        customer_landmark: buyerInfo.landmark.trim() || undefined,
        customer_notes: buyerInfo.notes.trim() || undefined,
        affiliate_code: affiliateCode,
        checkout_session_id: idempotencyKeyRef.current,
      });

      // Confirm payment via remote API
      await confirmPayment(order.id);

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
