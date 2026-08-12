/**
 * Normalize URLs/paths so GSC page URLs match GA4 landing pages.
 * Strips protocol, host, www, trailing slashes, and optionally query strings.
 */
export function normalizeLandingPage(
  input: string | null | undefined,
  options: { keepQuery?: boolean } = {},
): string {
  if (!input) return "/";

  let value = input.trim();
  if (!value) return "/";

  // Absolute URL → path (+ optional query)
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      value = options.keepQuery && url.search
        ? `${url.pathname}${url.search}`
        : url.pathname;
    }
  } catch {
    // keep as-is
  }

  // Strip accidental host leftovers like www.example.com/path
  value = value.replace(/^\/\/+/, "/");
  if (!value.startsWith("/")) {
    // host/path without scheme
    const slash = value.indexOf("/");
    if (slash > 0 && value.includes(".")) {
      value = value.slice(slash);
    } else {
      value = `/${value}`;
    }
  }

  if (!options.keepQuery) {
    const q = value.indexOf("?");
    if (q >= 0) value = value.slice(0, q);
  } else {
    // normalize path portion only
    const q = value.indexOf("?");
    if (q >= 0) {
      const path = stripTrailingSlash(value.slice(0, q));
      return `${path}${value.slice(q)}`;
    }
  }

  return stripTrailingSlash(value) || "/";
}

function stripTrailingSlash(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.replace(/\/+$/, "");
  }
  return path;
}

export function toDateOnly(input: Date | string): Date {
  if (typeof input === "string") {
    // YYYY-MM-DD or ISO
    const d = input.length === 10 ? new Date(`${input}T00:00:00.000Z`) : new Date(input);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

export function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
