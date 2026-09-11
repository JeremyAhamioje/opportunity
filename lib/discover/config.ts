/**
 * Tiny and dependency-free, like `parse/ai-config` — pages need to know whether
 * discovery is available without pulling the connector into their bundle.
 */
export function isDiscoverConfigured(): boolean {
  return Boolean(process.env.SERPAPI_KEY?.trim());
}
