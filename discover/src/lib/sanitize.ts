export const ALLOWED_RICH_TAGS = new Set([
  "P", "H2", "H3", "STRONG", "EM", "U", "S", "UL", "OL", "LI", "BLOCKQUOTE",
  "PRE", "CODE", "BR", "HR", "IMG", "A", "SPAN",
]);

export const BLOCK_TAGS = new Set(["P", "H2", "H3", "UL", "OL", "PRE", "BLOCKQUOTE", "IMG", "HR"]);

function safeUrl(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i.test(trimmed) && trimmed.length <= 300_000) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

/**
 * Allowlist sanitizer for TipTap-produced article HTML.
 * Removes scripts, iframes, event handlers, style attributes, and unsafe URLs.
 * Falls back to a lightweight regex scrub when the DOM is unavailable (SSR).
 */
export function sanitizeRichHtml(input: string): string {
  const source = String(input || "");
  if (!source.trim()) return "";

  if (typeof document === "undefined") {
    return source
      .replace(/<\s*(script|iframe|object|embed|style|link|meta|form|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*(script|iframe|object|embed|style|link|meta|form|base)\b[^>]*>/gi, "")
      .replace(/<\s*\/\s*(script|iframe|object|embed|style|link|meta|form|base)\s*>/gi, "")
      .replace(/\s+on[a-z][a-z0-9_-]*\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, "")
      .replace(/(href|src)\s*=\s*("data:[^"]*"|'data:[^']*'|data:[^\s>]+)/gi, "$1=\"\"");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "text/html");

  const walk = (root: ParentNode) => {
    for (const element of Array.from(root.querySelectorAll("*"))) {
      const tag = element.tagName.toUpperCase();
      if (!ALLOWED_RICH_TAGS.has(tag)) {
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on")) {
          element.removeAttribute(attribute.name);
          continue;
        }
        if (name === "style") {
          element.removeAttribute(attribute.name);
          continue;
        }
        if (["href", "src"].includes(name)) {
          const clean = safeUrl(attribute.value);
          if (!clean) {
            element.removeAttribute(attribute.name);
            continue;
          }
          element.setAttribute(attribute.name, clean);
          continue;
        }
        if (!["target", "rel", "alt", "title"].includes(name)) {
          element.removeAttribute(attribute.name);
        }
      }
      if (tag === "A") {
        if (!element.getAttribute("href")) {
          element.replaceWith(...Array.from(element.childNodes));
          continue;
        }
        element.setAttribute("rel", "noopener noreferrer");
      }
    }
  };

  const body = doc.body;
  walk(body);
  const fragment = document.createDocumentFragment();
  fragment.append(...Array.from(body.childNodes));
  return fragment.firstChild ? doc.body.innerHTML : "";
}

/** Sanitizer for plain-text fields rendered as HTML by the profile adapter (chips, paragraphs). */
export function sanitizePlainHtml(input: string): string {
  return sanitizeRichHtml(input)
    .replace(/<(?!\/?(?:p|li|br)\b)[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, " ");
}
