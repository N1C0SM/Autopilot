/** Social networks the admin can link. Pure: also used at build time for SEO. */
export const SOCIAL_NETWORKS = [
  { key: "instagram", label: "Instagram", base: "https://instagram.com/" },
  { key: "tiktok", label: "TikTok", base: "https://www.tiktok.com/@" },
  { key: "youtube", label: "YouTube", base: "https://www.youtube.com/@" },
  { key: "x", label: "X", base: "https://x.com/" },
  { key: "whatsapp", label: "WhatsApp", base: "https://wa.me/" },
] as const;

export type SocialKey = (typeof SOCIAL_NETWORKS)[number]["key"];

/** Turns «@usuario», «usuario», a phone or a full URL into a public link. Empty → null. */
export function socialUrl(key: SocialKey, raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const net = SOCIAL_NETWORKS.find((n) => n.key === key)!;
  if (key === "whatsapp") { const digits = v.replace(/\D/g, ""); return digits ? net.base + digits : null; }
  const handle = v.replace(/^@/, "").replace(/\s+/g, "");
  return handle ? net.base + handle : null;
}

export function socialLinkList(links: unknown): { key: SocialKey; label: string; url: string }[] {
  const obj = links && typeof links === "object" ? (links as Record<string, unknown>) : {};
  return SOCIAL_NETWORKS.flatMap((n) => { const url = socialUrl(n.key, obj[n.key]); return url ? [{ key: n.key, label: n.label, url }] : []; });
}
