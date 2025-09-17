import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flushLaunchVotes, getLaunchByDate } from '@/lib/launches';

export async function POST(
  request: Request,
  { params }: { params: { date: string } }
) {
  // Verify admin access
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
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

    // Return the updated launch
    const updatedLaunch = await getLaunchByDate(date);
    return NextResponse.json(updatedLaunch);
    
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
