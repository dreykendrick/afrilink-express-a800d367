import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useProduct } from '@/hooks/useProduct';
import { useCities, useSameCityZones, useCrossCityFee } from '@/hooks/useCities';
import { PageLoader } from '@/components/ui/PageLoader';
import { ErrorState } from '@/components/ui/ErrorState';
import { CheckoutHeader } from '@/components/checkout/CheckoutHeader';
import { BuyerForm } from '@/components/checkout/BuyerForm';
import { DeliveryFeeSection } from '@/components/checkout/DeliveryFeeSection';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { PaymentButton } from '@/components/checkout/PaymentButton';
import type { BuyerInfo } from '@/lib/types';

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Persist affiliate ref in sessionStorage on checkout load
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      sessionStorage.setItem('afrilink_affiliate', ref);
    }
  }, [searchParams]);
  
  const { data: product, isLoading: productLoading, error: productError } = useProduct(slug || '');
  const { data: cities = [], isLoading: citiesLoading } = useCities();

  // Buyer info state
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    name: '',
    phone: '',
    cityId: '',
    area: '',
    landmark: '',
    notes: '',
  });

  // Delivery calculation
  const vendorCityId = product?.vendor?.city_id || null;
  const isSameCity = vendorCityId === buyerInfo.cityId && !!buyerInfo.cityId;
  
  const { data: zones = [] } = useSameCityZones(isSameCity ? buyerInfo.cityId : null);
  const { data: crossCityFee } = useCrossCityFee(vendorCityId, buyerInfo.cityId);

  // Selected zone for same-city delivery
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const selectedZone = zones.find(z => z.id === selectedZoneId);

  // Calculate delivery fee
  const deliveryFee = isSameCity
    ? (selectedZone?.fee || 0)
    : (crossCityFee?.fee || 0);

  const itemPrice = product?.price || 0;
  const totalAmount = itemPrice + deliveryFee;

  if (productLoading || citiesLoading) {
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
      {/* Header */}
      <CheckoutHeader product={product} onBack={handleBack} />

      {/* Form */}
      <div className="flex-1 p-4 space-y-6">
        {/* Buyer Details */}
        <BuyerForm
          buyerInfo={buyerInfo}
          onChange={setBuyerInfo}
          cities={cities}
        />

        {/* Delivery Fee */}
        <DeliveryFeeSection
          isSameCity={isSameCity}
          zones={zones}
          selectedZoneId={selectedZoneId}
          onZoneSelect={setSelectedZoneId}
          crossCityFee={crossCityFee?.fee || null}
          vendorCityId={vendorCityId}
          buyerCityId={buyerInfo.cityId}
          cities={cities}
        />

        {/* Order Summary */}
        <OrderSummary
          itemPrice={itemPrice}
          deliveryFee={deliveryFee}
          totalAmount={totalAmount}
        />
      </div>

      {/* Payment Button */}
      <PaymentButton
        product={product}
        buyerInfo={buyerInfo}
        deliveryFee={deliveryFee}
        totalAmount={totalAmount}
        selectedZoneId={isSameCity ? selectedZoneId : undefined}
        onSuccess={handleOrderSuccess}
      />
    </div>
  );
}
