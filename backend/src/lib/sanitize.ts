const INTERNAL_HOST_RE = /^(localhost|127\.\d+\.\d+\.\d+|::1|::|0\.0\.0\.0|(10\.\d+|\d{1,3}\.10)\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/i;

export function isInternalHost(hostname: string): boolean {
  return INTERNAL_HOST_RE.test(hostname);
}

export const safeHttpUrl = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed.startsWith("//") ? false : true;
  let url: URL;
  try { url = new URL(trimmed); } catch { return false; }
  if (url.protocol !== "https:") return false;
  if (isInternalHost(url.hostname)) return false;
  return true;
};
