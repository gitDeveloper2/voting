import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createLaunch, getTodaysLaunchApps, flushLaunchVotes } from '@/lib/launches';

// Morning cron job to create daily launch
// This endpoint is protected by Vercel's cron secret

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

    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // 1. Flush yesterday's launch if it exists
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];
    
    try {
      const flushResult = await flushLaunchVotes(yesterdayKey);
      console.log('[CreateLaunch] Flushed previous launch:', flushResult);
    } catch (error) {
      console.log('[CreateLaunch] No previous launch to flush or already flushed:', error);
    }
    
    // 2. Get today's launch apps
    const appIds = await getTodaysLaunchApps();
    
    if (appIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No apps scheduled for launch today',
        date: today,
        apps: []
      });
    }
    
    // 3. Create today's launch
    try {
      const launch = await createLaunch(today, appIds);
      
      return NextResponse.json({
        success: true,
        message: 'Daily launch created successfully',
        launch: {
          date: launch.date,
          status: launch.status,
          appsCount: launch.apps.length,
          createdAt: launch.createdAt
        },
        apps: appIds
      });
    } catch (error) {
      // Launch might already exist
      if (error instanceof Error && error.message.includes('already exists')) {
        return NextResponse.json({
          success: true,
          message: 'Launch already exists for today',
          date: today,
          apps: appIds
        });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('[CreateLaunch] Error managing daily launch:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to manage daily launch',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
