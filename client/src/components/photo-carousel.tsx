import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PhotoCarouselProps {
  photos: string[];
  alt: string;
  className?: string; // sizing of the frame (e.g. "h-48")
  rounded?: string;
}

// Swipeable/tappable gallery for a profile's photos. Profiles can hold up to
// five pictures but every surface used to show only the first one.
export default function PhotoCarousel({ photos, alt, className = "h-48", rounded = "rounded-lg" }: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const list = (photos || []).filter(Boolean);
  if (list.length === 0) {
    return <div className={`w-full ${className} ${rounded} bg-gray-100`} />;
  }
  const current = Math.min(index, list.length - 1);
  const go = (delta: number) => setIndex((i) => (i + delta + list.length) % list.length);

  return (
    <div
      className={`relative w-full ${className} ${rounded} overflow-hidden bg-gray-100 select-none`}
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        setTouchStartX(null);
      }}
      data-testid="photo-carousel"
    >
      <img src={list[current]} alt={alt} className="w-full h-full object-cover" />
      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 shadow flex items-center justify-center"
            aria-label="previous"
            data-testid="button-photo-prev"
          >
            <ChevronLeft className="w-4 h-4 text-gray-700" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 shadow flex items-center justify-center"
            aria-label="next"
            data-testid="button-photo-next"
          >
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {list.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === current ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
