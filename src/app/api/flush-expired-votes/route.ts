import { NextRequest, NextResponse } from 'next/server';

// This endpoint is deprecated - vote flushing is now handled by the new launches system
// Use the dedicated cron jobs: /api/cron/create-launch and /api/cron/flush-launch

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Vote flushing moved to new launches system',
      message: 'Use /api/cron/flush-launch endpoint managed by the launches system'
    },
    { status: 410 } // Gone - resource no longer available
  );
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Vote flushing moved to new launches system',
      message: 'Use /api/cron/flush-launch endpoint managed by the launches system'
    },
    { status: 410 } // Gone - resource no longer available
  );
}

export function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
