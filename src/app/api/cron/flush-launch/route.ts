import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { flushLaunchVotes, getActiveLaunch } from '@/lib/launches';
// Local helper to call an external revalidation endpoint so callers only make one request to this API
async function revalidateExternal(path: string): Promise<void> {
  const base = process.env.REVALIDATION_ENDPOINT || 'http://localhost:3000';
  const normalizedBase = base.replace(/\/+$/, '');
  const url = /\/api\/revalidate$/.test(normalizedBase)
    ? normalizedBase
    : `${normalizedBase}/api/revalidate`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn('[FlushLaunch] External revalidation failed', { status: res.status, statusText: res.statusText, data });
    }
  } catch (err) {
    console.warn('[FlushLaunch] External revalidation error', err);
  }
}

// DEPRECATED: This endpoint has been replaced by /api/cron/daily-launch-cycle
// The new merged system handles both creation and flushing in a single atomic operation
// This endpoint is kept for backward compatibility but should not be used

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // DEPRECATED: This endpoint has been replaced by /api/cron/daily-launch-cycle
    console.log('[FlushLaunch] DEPRECATED endpoint called - use daily-launch-cycle instead');

    // Get the active launch
    const activeLaunch = await getActiveLaunch();
    
    if (!activeLaunch) {
      return NextResponse.json({
        success: true,
        message: 'No active launch to flush'
      });
    }
    
    // Flush the active launch votes
    const flushResult = await flushLaunchVotes(activeLaunch.date);
    
    // Call revalidation API after successful vote flushing
    if (flushResult.success) {
      await revalidateExternal('/launch');
    }
    
    return NextResponse.json({
      success: flushResult.success,
      message: flushResult.message,
      launch: {
        date: activeLaunch.date,
        appsCount: activeLaunch.apps.length
      },
      voteCounts: flushResult.voteCounts
    });
    
  } catch (error) {
    console.error('[FlushLaunch] Error flushing launch votes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to flush launch votes',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
