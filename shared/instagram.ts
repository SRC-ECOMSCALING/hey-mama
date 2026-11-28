// Instagram profile links typed by users: accepts "@name", "name" or any
// instagram.com profile link and stores one canonical URL.

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
const PROFILE_LINK_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/([^/?#]+)/i;

// "" for an empty value, null when the input isn't a valid Instagram profile.
export function normalizeInstagramUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const link = value.match(PROFILE_LINK_RE);
  if (!link && /[/:]/.test(value)) return null; // a link, but not to Instagram
  const handle = (link ? link[1] : value).replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) return null;
  return `https://www.instagram.com/${handle}/`;
}

// "@name" for display, from a stored profile URL.
export function instagramHandle(url: string): string {
  const link = url.match(PROFILE_LINK_RE);
  return link ? `@${link[1]}` : url;
}
