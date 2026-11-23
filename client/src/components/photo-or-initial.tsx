import { useEffect, useState } from "react";

// A profile's photo inside a round avatar frame. When there is no photo, or
// the picture cannot be loaded (deleted upload, dead old URL), it falls back
// to the name's initial instead of a broken image.
export default function PhotoOrInitial({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <>{name.charAt(0).toUpperCase()}</>;
  return <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}
