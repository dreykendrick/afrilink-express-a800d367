import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trackAffiliateClick } from '@/lib/api';
import { getSessionId } from '@/lib/format';

export function useAffiliateTracking(productId: string | undefined) {
  const [searchParams] = useSearchParams();
  const affiliateCode = searchParams.get('ref');

  const trackClick = useCallback(async () => {
    if (!affiliateCode || !productId) return;

    const sessionId = getSessionId();

    try {
      await trackAffiliateClick(affiliateCode, productId, sessionId);
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
