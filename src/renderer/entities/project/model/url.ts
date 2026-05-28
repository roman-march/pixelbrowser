export function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "http://localhost:3000";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

export function normalizePagePath(value: string) {
  const trimmed = value.trim() || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function resolvePageUrl(base: string, pagePath: string) {
  try {
    const url = new URL(normalizeUrl(base));
    url.pathname = normalizePagePath(pagePath);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return normalizeUrl(base);
  }
}

export function pagePathFromUrl(value: string) {
  try {
    const url = new URL(normalizeUrl(value));
    return normalizePagePath(url.pathname || "/");
  } catch {
    return "/";
  }
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
