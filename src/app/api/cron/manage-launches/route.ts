import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createLaunch, getTodaysLaunchApps, flushLaunchVotes, getActiveLaunch } from '@/lib/launches';

// Combined launch management cron job
// Runs every 6 hours to handle both launch creation and vote flushing
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
    const currentHour = now.getUTCHours();
    const today = now.toISOString().split('T')[0];
    
    let results = {
      createLaunch: null as any,
      flushLaunch: null as any,
      timestamp: now.toISOString(),
      currentHour
    };

    // Morning task (around 6 AM and 12 PM UTC): Create new launch
    if (currentHour >= 6 && currentHour < 18) {
      try {
        // 1. Flush yesterday's launch if it exists
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toISOString().split('T')[0];
        
        try {
          const flushResult = await flushLaunchVotes(yesterdayKey);
          console.log('[ManageLaunches] Flushed previous launch:', flushResult);
          results.flushLaunch = { previous: flushResult };
        } catch (error) {
          console.log('[ManageLaunches] No previous launch to flush or already flushed:', error);
        }
        
        // 2. Get today's launch apps
        const appIds = await getTodaysLaunchApps();
        
        if (appIds.length === 0) {
          results.createLaunch = {
            success: true,
            message: 'No apps scheduled for launch today',
            date: today,
            apps: []
          };
        } else {
          // 3. Create today's launch
          try {
            const launch = await createLaunch(today, appIds);
            
            results.createLaunch = {
              success: true,
              message: 'Daily launch created successfully',
              launch: {
                date: launch.date,
                status: launch.status,
                appsCount: launch.apps.length,
                createdAt: launch.createdAt
              },
              apps: appIds
            };
          } catch (error) {
            // Launch might already exist
            if (error instanceof Error && error.message.includes('already exists')) {
              results.createLaunch = {
                success: true,
                message: 'Launch already exists for today',
                date: today,
                apps: appIds
              };
            } else {
              throw error;
            }
          }
        }
      } catch (error) {
        console.error('[ManageLaunches] Error in create launch phase:', error);
        results.createLaunch = {
          success: false,
          error: 'Failed to manage launch creation',
          details: error instanceof Error ? error.message : String(error)
        };
      }
    }

    // Evening task (6 PM and later UTC): Flush active launch votes
    if (currentHour >= 18) {
      try {
        // Get the active launch
        const activeLaunch = await getActiveLaunch();
        
        if (!activeLaunch) {
          results.flushLaunch = {
            success: true,
            message: 'No active launch to flush'
          };
        } else {
          // Flush the active launch votes
          const flushResult = await flushLaunchVotes(activeLaunch.date);
          
          results.flushLaunch = {
            success: flushResult.success,
            message: flushResult.message,
            launch: {
              date: activeLaunch.date,
              appsCount: activeLaunch.apps.length
            },
            voteCounts: flushResult.voteCounts
          };
        }
      } catch (error) {
        console.error('[ManageLaunches] Error in flush launch phase:', error);
        results.flushLaunch = {
          success: false,
          error: 'Failed to flush launch votes',
          details: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Launch management completed',
      results
    });
    
  } catch (error) {
    console.error('[ManageLaunches] Error in combined launch management:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to manage launches',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
