export type VideoPlatform = "youtube" | "tiktok" | "instagram";
export function recognizeVideoSource(
  value: string,
): { platform: VideoPlatform; sourceUrl: string } | null {
  if (
    /[\u0000-\u0020\u007f]/.test(value.trim()) ||
    /%(?:2f|5c|2e)/i.test(value)
  )
    return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      url.pathname.includes("%") ||
      value.includes("\\")
    )
      return null;
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
        url.hostname,
      ) &&
      /^\/shorts\/[a-zA-Z0-9_-]{11}\/?$/.test(url.pathname)
    )
      return { platform: "youtube", sourceUrl: url.toString() };
    if (
      (["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(
        url.hostname,
      ) &&
        /^\/@[\w.-]+\/video\/\d+\/?$/.test(url.pathname)) ||
      (["vm.tiktok.com", "vt.tiktok.com"].includes(url.hostname) &&
        /^\/[a-zA-Z0-9]+\/?$/.test(url.pathname))
    )
      return { platform: "tiktok", sourceUrl: url.toString() };
    if (
      ["instagram.com", "www.instagram.com"].includes(url.hostname) &&
      /^\/reel\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)
    )
      return { platform: "instagram", sourceUrl: url.toString() };
  } catch {
    /* Untrusted input is never fetched. */
  }
  return null;
}
