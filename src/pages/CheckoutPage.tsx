import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useProduct } from '@/hooks/useProduct';
import { PageLoader } from '@/components/ui/PageLoader';
import { ErrorState } from '@/components/ui/ErrorState';
import { CheckoutHeader } from '@/components/checkout/CheckoutHeader';
import { BuyerForm } from '@/components/checkout/BuyerForm';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { PaymentButton } from '@/components/checkout/PaymentButton';
import type { BuyerInfo } from '@/lib/types';

export default function CheckoutPage() {
  const { slug: identifier } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      sessionStorage.setItem('afrilink_affiliate', ref);
    }
  }, [searchParams]);
  
  const { data: product, isLoading: productLoading, error: productError } = useProduct(identifier || '');

  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    name: '',
    phone: '',
    city: '',
    area: '',
    landmark: '',
    notes: '',
  });

  const itemPrice = product?.price || 0;
  const deliveryFee = 0;
  const totalAmount = itemPrice + deliveryFee;

  if (productLoading) {
    return <PageLoader message="Loading checkout..." />;
  }

  if (productError || !product) {
    return (
      <ErrorState
        title="Product not found"
        message="This product may no longer be available."
        onRetry={() => navigate(-1)}
      />
    );
  }

  const handleBack = () => {
    navigate(`/p/${product.slug}`);
  };

  const handleOrderSuccess = (orderId: string) => {
    navigate(`/receipt/${orderId}`);
  };

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <CheckoutHeader product={product} onBack={handleBack} />

      <div className="flex-1 p-4 space-y-6">
        <BuyerForm buyerInfo={buyerInfo} onChange={setBuyerInfo} />
        <OrderSummary
          itemPrice={itemPrice}
          deliveryFee={deliveryFee}
          totalAmount={totalAmount}
        />
      </div>

      <PaymentButton
        product={product}
        buyerInfo={buyerInfo}
        deliveryFee={deliveryFee}
        totalAmount={totalAmount}
        onSuccess={handleOrderSuccess}
      />
    </div>
  );
}
