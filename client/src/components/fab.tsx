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
    className={`fixed z-40 right-[max(1.25rem,calc(50vw-12.75rem))] bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))] w-14 h-14 rounded-full text-white shadow-[0_8px_24px_rgba(236,72,153,0.4)] flex items-center justify-center transition-transform hover:scale-105 ${className}`}
    style={{ background: "linear-gradient(135deg, var(--primary-pink), var(--accent-coral))" }}
  >
    {children}
  </button>
));
Fab.displayName = "Fab";

export default Fab;
