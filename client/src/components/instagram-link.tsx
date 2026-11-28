import { ExternalLink, Instagram } from "lucide-react";
import { instagramHandle } from "@shared/instagram";

// Compact "@name" row that opens a mom's Instagram profile, used inside the
// profile sheets (map sheet and "how others see me" preview).
export default function InstagramLink({ url, className = "" }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex h-11 items-center gap-2.5 rounded-2xl bg-gray-100 px-3.5 text-[15px] font-medium text-gray-900 ${className}`}
      data-testid="link-instagram"
    >
      <Instagram className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate">{instagramHandle(url)}</span>
      <ExternalLink className="h-4 w-4 shrink-0 text-gray-500" />
    </a>
  );
}
