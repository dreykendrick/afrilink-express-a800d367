import { AlertCircle } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this page. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm max-w-xs">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}
