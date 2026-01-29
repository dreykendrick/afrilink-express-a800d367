import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSessionId } from '@/lib/format';

export function useAffiliateTracking(productId: string | undefined) {
  const [searchParams] = useSearchParams();
  const affiliateCode = searchParams.get('ref');

  const trackClick = useCallback(async () => {
    if (!affiliateCode || !productId) return;

    const sessionId = getSessionId();

    try {
      // Get affiliate by code
      const { data: affiliate, error: affiliateError } = await supabase
        .from('affiliates')
        .select('id')
        .eq('code', affiliateCode)
        .eq('is_active', true)
        .maybeSingle();

      if (affiliateError || !affiliate) {
        console.log('Affiliate not found or inactive:', affiliateCode);
        return;
      }

      // Insert click (idempotent via unique constraint)
      const { error: clickError } = await supabase
        .from('affiliate_clicks')
        .insert({
          affiliate_id: affiliate.id,
          product_id: productId,
          session_id: sessionId,
        });

      if (clickError && !clickError.message.includes('duplicate')) {
        console.error('Error tracking affiliate click:', clickError);
      }
    } catch (err) {
      console.error('Affiliate tracking error:', err);
    }
  }, [affiliateCode, productId]);

  useEffect(() => {
    trackClick();
  }, [trackClick]);

  // Store affiliate code in session for checkout
  useEffect(() => {
    if (affiliateCode) {
      sessionStorage.setItem('afrilink_affiliate', affiliateCode);
    }
  }, [affiliateCode]);

  return {
    affiliateCode: affiliateCode || sessionStorage.getItem('afrilink_affiliate'),
  };
}
