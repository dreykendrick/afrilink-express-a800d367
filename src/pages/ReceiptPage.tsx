import { useParams, Link } from 'react-router-dom';
import { useOrder } from '@/hooks/useOrder';
import { PageLoader } from '@/components/ui/PageLoader';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusTimeline } from '@/components/receipt/StatusTimeline';
import { ReceiptDetails } from '@/components/receipt/ReceiptDetails';
import { CheckCircle2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading, error, refetch } = useOrder(orderId || '');

  if (isLoading) {
    return <PageLoader message="Loading your order..." />;
  }

  if (error || !order) {
    return (
      <ErrorState
        title="Order not found"
        message="We couldn't find this order. Please check your link."
        onRetry={() => refetch()}
      />
    );
  }

  // Show receipt for all orders (payment confirmation happens via backend/webhook)

  return (
    <div className="min-h-screen p-4 pb-8">
      <div className="text-center py-6 space-y-3">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Order Confirmed</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>

      <StatusTimeline status={order.status} />
      <ReceiptDetails order={order} />

      <div className="mt-6 text-center">
        <Link
          to="#"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          Need help with your order?
        </Link>
      </div>

      {order.status === 'delivered' && order.confirmation_token && (
        <div className="mt-6">
          <Link to={`/confirm/${order.id}?token=${order.confirmation_token}`}>
            <Button className="w-full h-12" variant="outline">
              Confirm Delivery
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
