import { NextRequest, NextResponse } from 'next/server';

// This endpoint is deprecated - vote snapshots are now handled by the launches system
// Use the launches system to get vote data from active launches

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Vote snapshots moved to launches system',
      message: 'Use the launches system to get vote data from active launches'
    },
    { status: 410 } // Gone - resource no longer available
  );
}

export function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
