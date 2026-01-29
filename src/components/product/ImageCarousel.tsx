import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

export function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const diff = startX.current - endX;

    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  const goTo = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, images.length - 1)));
  };

  if (!images.length) {
    return (
      <div className="aspect-square bg-secondary flex items-center justify-center">
        <span className="text-muted-foreground text-sm">No image</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Image */}
      <div
        ref={containerRef}
        className="aspect-square bg-secondary overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`${alt} - Image ${index + 1}`}
              className="w-full h-full object-cover flex-shrink-0"
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          ))}
        </div>
      </div>

      {/* Navigation Arrows (hidden on mobile) */}
      {images.length > 1 && (
        <>
          <button
            onClick={() => goTo(currentIndex - 1)}
            className={cn(
              'hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 items-center justify-center transition-opacity',
              currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-background'
            )}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => goTo(currentIndex + 1)}
            className={cn(
              'hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 items-center justify-center transition-opacity',
              currentIndex === images.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-background'
            )}
            disabled={currentIndex === images.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === currentIndex
                  ? 'bg-primary w-6'
                  : 'bg-foreground/30 hover:bg-foreground/50'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
