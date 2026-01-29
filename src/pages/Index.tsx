import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      {/* Logo */}
      <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6">
        <ShoppingBag className="w-8 h-8 text-primary-foreground" />
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold mb-2">AfriLink</h1>
      <p className="text-muted-foreground max-w-xs mb-8">
        Shop products from trusted vendors across Tanzania
      </p>

      {/* Demo Link */}
      <div className="card-premium p-4 w-full max-w-sm">
        <h2 className="font-semibold text-left mb-3">Demo Products</h2>
        <div className="space-y-3">
          <Link 
            to="/p/iphone-14-case?ref=AFF123"
            className="flex items-center justify-between p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <span className="text-sm">iPhone 14 Pro Case</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link 
            to="/p/wireless-earbuds?ref=AFF123"
            className="flex items-center justify-between p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <span className="text-sm">Wireless Earbuds Pro</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground mt-8">
        buy.afrilink.info · Checkout Experience
      </p>
    </div>
  );
};

export default Index;
