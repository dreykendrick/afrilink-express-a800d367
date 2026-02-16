import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useProduct } from '@/hooks/useProduct';
import { useAffiliateTracking } from '@/hooks/useAffiliateTracking';
import { ImageCarousel } from '@/components/product/ImageCarousel';
import { ProductDetails } from '@/components/product/ProductDetails';
import { PageLoader } from '@/components/ui/PageLoader';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { getProductUrl, getAppUrl } from '@/lib/url';

export default function ProductPage() {
  const { slug: identifier } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: product, isLoading, error, refetch } = useProduct(identifier || '');
  
  // Track affiliate click (idempotent)
  useAffiliateTracking(product?.id);

  if (isLoading) {
    return <PageLoader message="Loading product..." />;
  }

  if (error || !product) {
    return (
      <ErrorState
        title="Product not found"
        message="This product may no longer be available."
        onRetry={() => refetch()}
      />
    );
  }

  const handleBuyNow = () => {
    // Forward ref param to checkout for affiliate attribution
    const ref = searchParams.get('ref');
    const checkoutUrl = ref 
      ? `/checkout/${product.id}?ref=${encodeURIComponent(ref)}`
      : `/checkout/${product.id}`;
    navigate(checkoutUrl);
  };

  // SEO meta tags for WhatsApp share preview - use canonical production URL
  const metaImage = product.image_urls?.[0] || product.image_url || '/placeholder.svg';
  const metaDescription = product.description?.slice(0, 160) || product.title;
  const canonicalUrl = getProductUrl(product.id);
  const appUrl = getAppUrl();
  
  // Make image URL absolute for social sharing
  const absoluteImageUrl = metaImage.startsWith('http') 
    ? metaImage 
    : `${appUrl}${metaImage.startsWith('/') ? metaImage : '/' + metaImage}`;

  return (
    <>
      <Helmet>
        <title>{product.title} | AfriLink</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Open Graph for WhatsApp/Social - using canonical production URL */}
        <meta property="og:title" content={product.title} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={absoluteImageUrl} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="AfriLink" />
        <meta property="product:price:amount" content={String(product.price)} />
        <meta property="product:price:currency" content="TZS" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={product.title} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={absoluteImageUrl} />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        {/* Product Image Carousel */}
        <ImageCarousel images={product.image_urls || []} alt={product.title} />

        {/* Product Details */}
        <div className="flex-1">
          <ProductDetails product={product} />
        </div>

        {/* Fixed Bottom CTA */}
        <div className="sticky bottom-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border safe-bottom">
          <Button
            onClick={handleBuyNow}
            className="w-full h-14 text-lg font-semibold btn-glow"
            size="lg"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Buy Now · {formatPrice(product.price)}
          </Button>
        </div>
      </div>
    </>
  );
}
