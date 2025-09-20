import { NextRequest, NextResponse } from 'next/server';
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from '@/utils/api';

// This endpoint is deprecated - vote snapshots are now handled by the launches system
// Use the launches system to get vote data from active launches

export async function GET(req: NextRequest) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);

  return NextResponse.json(
    { 
      success: false, 
      error: 'Vote snapshots moved to launches system',
      message: 'Use the launches system to get vote data from active launches'
    },
    { status: 410, headers: buildCorsHeaders(origin) } // Gone - resource no longer available
  );
}

export function OPTIONS(req: NextRequest) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}
