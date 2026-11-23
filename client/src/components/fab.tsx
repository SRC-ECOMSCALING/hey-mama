import type { ReactNode } from "react";
import { forwardRef } from "react";

interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

// Floating action button: the page's main action, above the bottom nav.
// forwardRef so it can be used as a Radix DialogTrigger (asChild).
const Fab = forwardRef<HTMLButtonElement, FabProps>(({ children, className = "", ...props }, ref) => (
  <button
    ref={ref}
    {...props}
    className={`fixed z-40 right-[max(1.25rem,calc(50vw-12.75rem))] bottom-[calc(6.25rem_+_env(safe-area-inset-bottom))] flex h-14 w-14 items-center justify-center rounded-full bg-pink-500 text-white shadow-[0_10px_24px_rgba(216,27,114,0.35)] ${className}`}
  >
    {children}
  </button>
));
Fab.displayName = "Fab";

export default Fab;
