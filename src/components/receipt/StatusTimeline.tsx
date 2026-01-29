import { CheckCircle2, Package, Truck, MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';

interface StatusTimelineProps {
  status: OrderStatus;
}

const STATUSES = [
  { key: 'paid', label: 'Paid', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: Package },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: MapPin },
] as const;

const STATUS_ORDER: readonly string[] = ['paid', 'preparing', 'out_for_delivery', 'delivered', 'confirmed'];

export function StatusTimeline({ status }: StatusTimelineProps) {
  const currentIndex = STATUS_ORDER.indexOf(status);

  return (
    <div className="card-premium p-4 my-4">
      <h3 className="font-semibold mb-4">Order Status</h3>
      
      <div className="relative">
        {STATUSES.map((step, index) => {
          const isCompleted = currentIndex >= STATUS_ORDER.indexOf(step.key);
          const isCurrent = status === step.key;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-start gap-3 relative">
              {/* Connector Line */}
              {index < STATUSES.length - 1 && (
                <div
                  className={cn(
                    'absolute left-[15px] top-8 w-0.5 h-8',
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}

              {/* Icon */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
              </div>

              {/* Label */}
              <div className="pb-6">
                <p
                  className={cn(
                    'font-medium text-sm',
                    isCompleted ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <div className="flex items-center gap-1 text-xs text-primary mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>Current status</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Confirmation step (special) */}
        {status === 'confirmed' && (
          <div className="flex items-center gap-3 text-success">
            <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-success-foreground" />
            </div>
            <p className="font-medium text-sm">Delivery Confirmed</p>
          </div>
        )}
      </div>
    </div>
  );
}
