import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { flushLaunchVotes, getLaunchByDate } from '@/lib/launches';
import { revalidateLaunchPage } from '@/lib/revalidation';

export async function POST(
  request: Request,
  { params }: { params: { date: string } }
) {
  // Verify admin access
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { date } = params;
  
  try {
    // Verify launch exists and is active
    const launch = await getLaunchByDate(date);
    if (!launch) {
      return NextResponse.json(
        { error: 'Launch not found' },
        { status: 404 }
      );
    }
    
    if (launch.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active launches can be flushed' },
        { status: 400 }
      );
    }

    // Flush the launch
    const result = await flushLaunchVotes(date);
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to flush launch');
    }

    // Call revalidation API after successful vote flushing
    await revalidateLaunchPage();

    // Return the flush result with updated launch info
    const updatedLaunch = await getLaunchByDate(date);
    return NextResponse.json({
      success: true,
      message: result.message,
      voteCounts: result.voteCounts,
      launch: updatedLaunch
    });
    
  } catch (error) {
    console.error(`Failed to flush launch ${date}:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to flush launch',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
