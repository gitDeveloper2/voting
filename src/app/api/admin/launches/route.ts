import { NextResponse } from 'next/server';
import { getPastLaunches, LaunchDocument } from '@/lib/launches';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  // Verify admin access
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Get all launches (past and current)
    const launches = await getPastLaunches(100); // Get up to 100 most recent launches
    return NextResponse.json(launches);
  } catch (error) {
    console.error('Failed to fetch launches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch launches' },
      { status: 500 }
    );
  }
}
