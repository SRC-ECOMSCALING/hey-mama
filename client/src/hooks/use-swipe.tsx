import { useRef, useEffect } from "react";

interface SwipeOptions {
  onSwipedLeft?: () => void;
  onSwipedRight?: () => void;
  onSwipedUp?: () => void;
  onSwipedDown?: () => void;
  preventDefaultTouchmoveEvent?: boolean;
  trackMouse?: boolean;
  threshold?: number;
}

export function useSwipe(options: SwipeOptions = {}) {
  const {
    onSwipedLeft,
    onSwipedRight,
    onSwipedUp,
    onSwipedDown,
    preventDefaultTouchmoveEvent = false,
    trackMouse = false,
    threshold = 50,
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const endRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleStart = (clientX: number, clientY: number) => {
      startRef.current = { x: clientX, y: clientY };
    };

    const handleMove = (clientX: number, clientY: number, event?: Event) => {
      if (preventDefaultTouchmoveEvent && event) {
        event.preventDefault();
      }
      endRef.current = { x: clientX, y: clientY };
    };

    const handleEnd = () => {
      const deltaX = endRef.current.x - startRef.current.x;
      const deltaY = endRef.current.y - startRef.current.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (Math.max(absDeltaX, absDeltaY) < threshold) return;

      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0) {
          onSwipedRight?.();
        } else {
          onSwipedLeft?.();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          onSwipedDown?.();
        } else {
          onSwipedUp?.();
        }
      }
    };

    // Touch events
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY, e);
    };

    const handleTouchEnd = () => {
      handleEnd();
    };

    // Mouse events (if trackMouse is true)
    let isMouseDown = false;
    const handleMouseDown = (e: MouseEvent) => {
      if (!trackMouse) return;
      isMouseDown = true;
      handleStart(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackMouse || !isMouseDown) return;
      handleMove(e.clientX, e.clientY, e);
    };

    const handleMouseUp = () => {
      if (!trackMouse || !isMouseDown) return;
      isMouseDown = false;
      handleEnd();
    };

    // Add event listeners
    element.addEventListener("touchstart", handleTouchStart);
    element.addEventListener("touchmove", handleTouchMove);
    element.addEventListener("touchend", handleTouchEnd);

    if (trackMouse) {
      element.addEventListener("mousedown", handleMouseDown);
      element.addEventListener("mousemove", handleMouseMove);
      element.addEventListener("mouseup", handleMouseUp);
      element.addEventListener("mouseleave", handleMouseUp);
    }

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);

      if (trackMouse) {
        element.removeEventListener("mousedown", handleMouseDown);
        element.removeEventListener("mousemove", handleMouseMove);
        element.removeEventListener("mouseup", handleMouseUp);
        element.removeEventListener("mouseleave", handleMouseUp);
      }
    };
  }, [onSwipedLeft, onSwipedRight, onSwipedUp, onSwipedDown, preventDefaultTouchmoveEvent, trackMouse, threshold]);

  return { ref: elementRef };
}
