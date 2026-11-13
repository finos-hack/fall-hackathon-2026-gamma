/** Exact id, or prefix glob "x.*" (matches ids starting with "x."). */
export function matches(pattern: string, service: string): boolean {
  if (pattern.endsWith('.*')) return service.startsWith(pattern.slice(0, -1));
  return pattern === service;
}

export function matchesAny(patterns: string[], service: string): boolean {
  return patterns.some((p) => matches(p, service));
}
