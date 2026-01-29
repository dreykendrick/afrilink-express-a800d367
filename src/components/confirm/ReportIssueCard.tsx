import { useState } from 'react';
import { ChevronLeft, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Order } from '@/lib/types';

interface ReportIssueCardProps {
  order: Order;
  onBack: () => void;
  onSubmitted: () => void;
}

const ISSUE_REASONS = [
  { value: 'wrong_item', label: 'Wrong item received' },
  { value: 'damaged', label: 'Item is damaged' },
  { value: 'incomplete', label: 'Order is incomplete' },
  { value: 'not_received', label: "Didn't receive the item" },
  { value: 'other', label: 'Other issue' },
];

export function ReportIssueCard({ order, onBack, onSubmitted }: ReportIssueCardProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason) {
      toast({
        variant: 'destructive',
        title: 'Please select a reason',
        description: 'Let us know what went wrong.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.from('order_issues').insert({
        order_id: order.id,
        reason: ISSUE_REASONS.find((r) => r.value === reason)?.label || reason,
        notes: notes.trim() || null,
      });

      if (error) {
        console.error('Issue report error:', error);
        throw new Error('Failed to report issue');
      }

      toast({
        title: 'Issue reported',
        description: "We'll look into this and get back to you.",
      });

      onSubmitted();
    } catch (err) {
      console.error('Report error:', err);
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
    <div className="card-premium p-4 space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <div>
        <h3 className="font-semibold">What's the issue?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select the reason that best describes your problem
        </p>
      </div>

      <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
        {ISSUE_REASONS.map((r) => (
          <div
            key={r.value}
            className="flex items-center space-x-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
            onClick={() => setReason(r.value)}
          >
            <RadioGroupItem value={r.value} id={r.value} />
            <Label htmlFor={r.value} className="flex-1 cursor-pointer">
              {r.label}
            </Label>
          </div>
        ))}
      </RadioGroup>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-muted-foreground">
          Additional details (optional)
        </Label>
        <Textarea
          id="notes"
          placeholder="Describe the issue in more detail..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[80px] resize-none"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isLoading || !reason}
        className="w-full h-12"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Submit Report
          </>
        )}
      </Button>
    </div>
  );
}
