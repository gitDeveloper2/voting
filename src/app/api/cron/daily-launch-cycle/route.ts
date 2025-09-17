import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createLaunch, getTodaysLaunchApps, flushLaunchVotes, getActiveLaunch } from '@/lib/launches';
import { revalidateLaunchPage } from '@/lib/revalidation';

// Single daily cron job that handles the complete launch cycle
// Runs once per day at 6 AM UTC to handle both flushing and creation
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
    const today = now.toISOString().split('T')[0];
    
    let results = {
      flushPrevious: null as any,
      createNew: null as any,
      timestamp: now.toISOString(),
      cycleComplete: false
    };

    console.log(`[DailyLaunchCycle] Starting daily cycle for ${today}`);

    // STEP 1: Flush any active launch (from previous day)
    try {
      const activeLaunch = await getActiveLaunch();
      
      if (activeLaunch) {
        console.log(`[DailyLaunchCycle] Found active launch: ${activeLaunch.date}`);
        
        // Only flush if it's not today's launch (safety check)
        if (activeLaunch.date !== today) {
          const flushResult = await flushLaunchVotes(activeLaunch.date);
          console.log(`[DailyLaunchCycle] Flushed launch ${activeLaunch.date}:`, flushResult);
          
          results.flushPrevious = {
            success: flushResult.success,
            message: flushResult.message,
            launchDate: activeLaunch.date,
            voteCounts: flushResult.voteCounts
          };
          
          // Trigger revalidation after flushing
          if (flushResult.success) {
            await revalidateLaunchPage();
          }
        } else {
          results.flushPrevious = {
            success: true,
            message: 'Active launch is for today - skipping flush',
            launchDate: activeLaunch.date
          };
        }
      } else {
        results.flushPrevious = {
          success: true,
          message: 'No active launch to flush'
        };
      }
    } catch (error) {
      console.error('[DailyLaunchCycle] Error flushing previous launch:', error);
      results.flushPrevious = {
        success: false,
        error: 'Failed to flush previous launch',
        details: error instanceof Error ? error.message : String(error)
      };
    }

    // STEP 2: Create today's new launch
    try {
      const appIds = await getTodaysLaunchApps();
      
      if (appIds.length === 0) {
        results.createNew = {
          success: true,
          message: 'No apps scheduled for launch today',
          date: today,
          apps: []
        };
      } else {
        try {
          const newLaunch = await createLaunch(today, appIds);
          
          console.log(`[DailyLaunchCycle] Created new launch for ${today} with ${appIds.length} apps`);
          
          results.createNew = {
            success: true,
            message: 'New launch created successfully',
            launch: {
              date: newLaunch.date,
              status: newLaunch.status,
              appsCount: newLaunch.apps.length,
              createdAt: newLaunch.createdAt
            },
            apps: appIds
          };
          
          // Trigger revalidation after creating new launch
          await revalidateLaunchPage();
          
        } catch (error) {
          // Launch might already exist
          if (error instanceof Error && error.message.includes('already exists')) {
            results.createNew = {
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
      console.error('[DailyLaunchCycle] Error creating new launch:', error);
      results.createNew = {
        success: false,
        error: 'Failed to create new launch',
        details: error instanceof Error ? error.message : String(error)
      };
    }

    // STEP 3: Determine overall success
    const flushSuccess = results.flushPrevious?.success !== false;
    const createSuccess = results.createNew?.success !== false;
    results.cycleComplete = flushSuccess && createSuccess;

    console.log(`[DailyLaunchCycle] Daily cycle completed. Success: ${results.cycleComplete}`);

    return NextResponse.json({
      success: results.cycleComplete,
      message: results.cycleComplete 
        ? 'Daily launch cycle completed successfully'
        : 'Daily launch cycle completed with some errors',
      results,
      nextCycle: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    
  } catch (error) {
    console.error('[DailyLaunchCycle] Critical error in daily cycle:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Critical failure in daily launch cycle',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
