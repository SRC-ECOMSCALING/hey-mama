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
export default function PhotoCarousel({ photos, alt, className = "h-48", rounded = "rounded-3xl" }: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  // Pictures that failed to load are dropped instead of showing a broken image
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const list = (photos || []).filter((url) => url && !broken.has(url));
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
      <img
        src={list[current]}
        alt={alt}
        onError={() => setBroken((prev) => new Set(prev).add(list[current]))}
        className="w-full h-full object-cover"
      />
      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="glass absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
            aria-label="previous"
            data-testid="button-photo-prev"
          >
            <ChevronLeft className="w-4 h-4 text-gray-700" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="glass absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
            aria-label="next"
            data-testid="button-photo-next"
          >
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </button>
          <div className="absolute left-4 right-4 top-3 flex gap-1.5" aria-hidden="true">
            {list.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i === current ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
