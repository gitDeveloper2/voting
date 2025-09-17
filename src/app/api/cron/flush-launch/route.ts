import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { flushLaunchVotes, getActiveLaunch } from '@/lib/launches';
import { revalidateLaunchPage } from '@/lib/revalidation';

// DEPRECATED: This endpoint has been replaced by /api/cron/daily-launch-cycle
// The new merged system handles both creation and flushing in a single atomic operation
// This endpoint is kept for backward compatibility but should not be used

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Verify this is a cron job request
    const authHeader = (await headers()).get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      await revalidateLaunchPage();
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
