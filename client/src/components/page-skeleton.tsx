// Unified skeleton loading for every page. One visual language (soft shimmer
// blocks) instead of the mix of spinners the app used to have.

interface SkProps {
  className?: string;
}

// Single shimmer block
export function Sk({ className = "" }: SkProps) {
  return <div className={`skeleton-shimmer rounded-2xl ${className}`} />;
}

// Fake sticky header with title + action circle
function HeaderSkeleton() {
  return (
    <div className="bg-white/85 backdrop-blur-xl shadow-sm sticky top-0 z-40 p-4 flex items-center gap-3">
      <Sk className="h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-2">
        <Sk className="h-4 w-32 rounded-md" />
        <Sk className="h-3 w-48 rounded-md" />
      </div>
      <Sk className="h-9 w-9 rounded-full" />
    </div>
  );
}

function ListCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
      <Sk className="w-14 h-14 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Sk className="h-4 w-2/3 rounded-md" />
        <Sk className="h-3 w-1/2 rounded-md" />
        <Sk className="h-3 w-1/3 rounded-md" />
      </div>
    </div>
  );
}

export type SkeletonVariant = "list" | "grid" | "map" | "chat" | "profile" | "form";

export default function PageSkeleton({ variant = "list" }: { variant?: SkeletonVariant }) {
  if (variant === "map") {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-gray-100">
        <div className="absolute inset-0 skeleton-shimmer" />
        <div className="absolute left-4 right-4 top-[calc(1rem_+_env(safe-area-inset-top))] bg-white shadow-lg rounded-2xl p-4 flex items-center justify-between">
          <Sk className="h-9 w-9 rounded-full" />
          <Sk className="h-8 w-28 rounded-xl" />
          <Sk className="h-9 w-9 rounded-full" />
        </div>
      </div>
    );
  }

  if (variant === "chat") {
    return (
      <div className="flex flex-col h-[100dvh] bg-gray-50">
        <div className="bg-white shadow-sm p-4 flex items-center gap-3 safe-top">
          <Sk className="h-9 w-9 rounded-full" />
          <Sk className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Sk className="h-4 w-32 rounded-md" />
            <Sk className="h-3 w-40 rounded-md" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          <Sk className="h-10 w-1/2 rounded-2xl" />
          <Sk className="h-10 w-2/5 rounded-2xl ml-auto" />
          <Sk className="h-16 w-3/5 rounded-2xl" />
          <Sk className="h-10 w-1/2 rounded-2xl ml-auto" />
        </div>
        <div className="p-3 bg-white border-t border-gray-100 safe-bottom">
          <Sk className="h-11 w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (variant === "profile") {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <div className="p-6 flex flex-col items-center gap-3 bg-white">
          <Sk className="w-28 h-28 rounded-full" />
          <Sk className="h-5 w-40 rounded-md" />
          <Sk className="h-3 w-24 rounded-md" />
        </div>
        <div className="p-4 space-y-4">
          <Sk className="h-24 w-full" />
          <Sk className="h-20 w-full" />
          <Sk className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <HeaderSkeleton />
        <div className="p-4 space-y-4">
          <Sk className="h-11 w-full rounded-full" />
          <div className="flex gap-2">
            <Sk className="h-8 w-20 rounded-full" />
            <Sk className="h-8 w-24 rounded-full" />
            <Sk className="h-8 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <Sk className="h-36 w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Sk className="h-3.5 w-4/5 rounded-md" />
                  <Sk className="h-3 w-2/5 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <HeaderSkeleton />
        <div className="p-4 space-y-4">
          <Sk className="h-32 w-full" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Sk className="h-3.5 w-28 rounded-md" />
              <Sk className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // default: "list"
  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <HeaderSkeleton />
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <ListCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
