import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useProduct } from '@/hooks/useProduct';
import { fetchDeliverySettings } from '@/lib/api';
import { calculateDeliveryEstimate, DEFAULT_DELIVERY_SETTINGS } from '@/lib/delivery';
import { PageLoader } from '@/components/ui/PageLoader';
import { ErrorState } from '@/components/ui/ErrorState';
import { CheckoutHeader } from '@/components/checkout/CheckoutHeader';
import { BuyerForm } from '@/components/checkout/BuyerForm';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { PaymentButton } from '@/components/checkout/PaymentButton';
import type { BuyerInfo, DeliverySettings } from '@/lib/types';

export default function CheckoutPage() {
  const { slug: identifier } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const orderSource = (searchParams.get('source') === 'marketplace' ? 'marketplace' : 'affiliate_link') as import('@/lib/types').CheckoutSource;

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
    delivery_address: '',
    delivery_lat: null,
    delivery_lng: null,
    landmark: '',
    notes: '',
  });

  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);

  useEffect(() => {
    fetchDeliverySettings()
      .then(setDeliverySettings)
      .catch((err) => console.error('Failed to load delivery settings:', err));
  }, []);

  const itemPrice = product?.price || 0;

  if (import.meta.env.DEV && product) {
    console.log('[DEBUG] CheckoutPage vendor location:', {
      vendor_lat: product.vendor_lat,
      vendor_lng: product.vendor_lng,
      vendor_address: product.vendor_address,
      lat_type: typeof product.vendor_lat,
      lng_type: typeof product.vendor_lng,
    });
  }

  const vendorLocationMissing = product != null && (product.vendor_lat == null || product.vendor_lng == null);

  const deliveryEstimate = useMemo(
    () =>
      calculateDeliveryEstimate(
        product?.vendor_lat ?? null,
        product?.vendor_lng ?? null,
        buyerInfo.delivery_lat,
        buyerInfo.delivery_lng,
        deliverySettings,
        itemPrice,
      ),
    [product?.vendor_lat, product?.vendor_lng, buyerInfo.delivery_lat, buyerInfo.delivery_lng, deliverySettings, itemPrice],
  );

  const totalAmount = vendorLocationMissing ? itemPrice : itemPrice + deliveryEstimate.delivery_fee;

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
          deliveryFee={deliveryEstimate.delivery_fee}
          totalAmount={totalAmount}
          distanceKm={deliveryEstimate.distance_km}
          isWithinRange={deliveryEstimate.is_within_range}
          rangeErrorMessage={deliveryEstimate.error_message}
        />
      </div>

      <PaymentButton
        product={product}
        buyerInfo={buyerInfo}
        deliveryFee={deliveryEstimate.delivery_fee}
        totalAmount={totalAmount}
        isWithinRange={deliveryEstimate.is_within_range}
        onSuccess={handleOrderSuccess}
        source={orderSource}
      />
    </div>
  );
}
