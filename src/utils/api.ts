export function hasSub(user: any): user is { sub: string } {
    return !!user && typeof user !== 'string' && typeof user.sub === 'string';
  }

// CORS utilities
export function parseAllowedOrigins(envValue: string | undefined): string[] {
    if (!envValue) return ['*'];
    return envValue
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
}

export function resolveAllowedOrigin(requestOrigin: string | null, allowedOrigins: string[]): string {
    // If wildcard allowed, echo request origin (works with credentials)
    if (allowedOrigins.includes('*')) return requestOrigin || '*';
    if (!requestOrigin) return 'null';
    // Exact match only (can extend to regex if needed)
    return allowedOrigins.includes(requestOrigin) ? requestOrigin : 'null';
}

export function buildCorsHeaders(origin: string) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    } as Record<string, string>;
}