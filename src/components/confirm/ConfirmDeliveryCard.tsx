import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Order } from '@/lib/types';

interface ConfirmDeliveryCardProps {
  order: Order;
  onConfirmed: () => void;
  onReportIssue: () => void;
}

export function ConfirmDeliveryCard({ order, onConfirmed, onReportIssue }: ConfirmDeliveryCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          order_status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('confirmation_token', order.confirmation_token);

      if (error) {
        console.error('Confirmation error:', error);
        throw new Error('Failed to confirm delivery');
      }

      toast({
        title: 'Delivery confirmed!',
        description: 'Thank you for shopping with AfriLink.',
      });

      onConfirmed();
    } catch (err) {
      console.error('Confirm error:', err);
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleConfirm}
        disabled={isLoading}
        className="w-full h-14 text-lg font-semibold btn-glow"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Confirming...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Confirm Delivery
          </>
        )}
      </Button>

      <Button
        onClick={onReportIssue}
        variant="outline"
        className="w-full h-12"
        disabled={isLoading}
      >
        Report an Issue
      </Button>
    </div>
  );
}
