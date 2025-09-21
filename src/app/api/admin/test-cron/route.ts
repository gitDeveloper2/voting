import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Test endpoint to manually trigger the daily launch cycle
// This is useful for testing the cron job functionality
export async function POST() {
  // Verify admin access
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Call the daily launch cycle endpoint directly (no secret needed)
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    console.log('[TestCron] Triggering daily launch cycle manually...');

    const response = await fetch(`${baseUrl}/api/cron/daily-launch-cycle`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'manual-test-cron'
      },
    });

    const data = await response.json();

    return NextResponse.json({
      success: response.ok,
      message: 'Cron job triggered successfully',
      cronResponse: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to trigger cron job:', error);
    return NextResponse.json(
      { error: 'Failed to trigger cron job' },
      { status: 500 }
    );
  }
}
