import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useOrderByToken } from '@/hooks/useOrder';
import { PageLoader } from '@/components/ui/PageLoader';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDeliveryCard } from '@/components/confirm/ConfirmDeliveryCard';
import { ReportIssueCard } from '@/components/confirm/ReportIssueCard';
import { ConfirmationSuccess } from '@/components/confirm/ConfirmationSuccess';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDeliveryPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  
  const { data: order, isLoading, error, refetch } = useOrderByToken(orderId || '', token);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);

  if (isLoading) {
    return <PageLoader message="Loading order..." />;
  }

  if (error || !order) {
    return (
      <ErrorState
        title="Invalid link"
        message="This confirmation link is invalid or has expired."
        onRetry={() => refetch()}
      />
    );
  }

  // Already confirmed
  if (order.confirmed_at || order.order_status === 'confirmed') {
    return <ConfirmationSuccess order={order} />;
  }

  // Just confirmed in this session
  if (isConfirmed) {
    return <ConfirmationSuccess order={order} />;
  }

  return (
    <div className="min-h-screen p-4 pb-8">
      {/* Warning Header */}
      <div className="text-center py-6 space-y-3">
        <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-warning" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Confirm Delivery</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
            Only confirm after you have received and checked your product
          </p>
        </div>
      </div>

      {/* Order Summary */}
      <div className="card-premium p-4 mb-4">
        <div className="flex items-center gap-3">
          {(order.product?.image_urls?.[0] || order.product?.image_url) && (
            <img
              src={order.product.image_urls?.[0] || order.product.image_url!}
              alt={order.product.title}
              className="w-16 h-16 rounded-lg object-cover bg-secondary"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{order.product?.title}</p>
            <p className="text-xs text-muted-foreground">Order #{order.order_number}</p>
          </div>
        </div>
      </div>

      {/* Confirmation Actions */}
      {!showIssueForm ? (
        <ConfirmDeliveryCard
          order={order}
          onConfirmed={() => setIsConfirmed(true)}
          onReportIssue={() => setShowIssueForm(true)}
        />
      ) : (
        <ReportIssueCard
          order={order}
          onBack={() => setShowIssueForm(false)}
          onSubmitted={() => setShowIssueForm(false)}
        />
      )}
    </div>
  );
}
