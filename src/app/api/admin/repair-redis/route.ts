import { NextRequest, NextResponse } from 'next/server';
import { repairActiveLaunchRedis } from '@/lib/launches';
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from '@/utils/api';

/**
 * POST /api/admin/repair-redis
 * Repairs Redis data to sync with active MongoDB launch
 * This fixes the issue where MongoDB has an active launch but Redis keys are missing/expired
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  console.log(`[RepairRedis][${requestId}][START] ${timestamp} - Redis repair request`);
  
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  
  try {
    console.log(`[RepairRedis][${requestId}][EXECUTE] Starting Redis repair...`);
    
    const result = await repairActiveLaunchRedis();
    
    console.log(`[RepairRedis][${requestId}][RESULT]`, {
      success: result.success,
      message: result.message,
      details: result.details
    });
    
    const statusCode = result.success ? 200 : 500;
    
    console.log(`[RepairRedis][${requestId}][END] Request completed with status ${statusCode} in ${Date.now() - new Date(timestamp).getTime()}ms`);
    
    return NextResponse.json(result, { 
      status: statusCode, 
      headers: buildCorsHeaders(origin) 
    });
    
  } catch (error) {
    console.error(`[RepairRedis][${requestId}][ERROR] Unexpected error:`, error);
    
    return NextResponse.json({
      success: false,
      message: `Repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { 
      status: 500, 
      headers: buildCorsHeaders(origin) 
    });
  }
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
