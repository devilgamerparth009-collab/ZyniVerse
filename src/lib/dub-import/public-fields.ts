/**
 * Public DTO scrubbing for the dub API.
 *
 * The row -> DTO conversion in `queries.ts` carries internal provider fields
 * (`source`, `sourceName`, and their `provider*` aliases) into public JSON.
 * Those names reveal the upstream content partner behind a white-labelled hub
 * and are not needed to render catalogue/schedule UI, so the route handlers
 * strip them from every outgoing body. `queries.ts` itself is intentionally
 * left untouched; it is shared with the server-rendered pages.
 */
const PROVIDER_FIELD_NAMES = new Set([
  "source",
  "sourceName",
  "provider",
  "providerName",
]);

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (PROVIDER_FIELD_NAMES.has(key)) continue;
      out[key] = scrub(nested);
    }
    return out;
  }
  return value;
}

export function withoutProviderFields<T>(body: T): T {
  return scrub(body) as T;
}
