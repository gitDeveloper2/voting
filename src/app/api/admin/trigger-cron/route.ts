import { NextRequest, NextResponse } from 'next/server';
import { createLaunch, getTodaysLaunchApps, flushLaunchVotes, getActiveLaunch } from '@/lib/launches';
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
      console.warn('[TriggerCron] External revalidation failed', { status: res.status, statusText: res.statusText, data });
    }
  } catch (err) {
    console.warn('[TriggerCron] External revalidation error', err);
  }
}
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from '@/utils/api';

/**
 * POST /api/admin/trigger-cron
 * Manually triggers the daily launch cycle for testing
 * This directly executes the same logic as the cron job without requiring authentication
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  console.log(`[TriggerCron][${requestId}][START] ${timestamp} - Manual cron trigger`);
  
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    let results = {
      flushPrevious: null as any,
      createNew: null as any,
      timestamp: now.toISOString(),
      cycleComplete: false
    };

    console.log(`[TriggerCron][${requestId}] Starting manual daily cycle for ${today}`);

    // STEP 1: Flush any active launch (from previous day)
    try {
      const activeLaunch = await getActiveLaunch();
      
      if (activeLaunch) {
        console.log(`[TriggerCron][${requestId}] Found active launch: ${activeLaunch.date}`);
        
        // Only flush if it's not today's launch (safety check)
        if (activeLaunch.date !== today) {
          const flushResult = await flushLaunchVotes(activeLaunch.date);
          console.log(`[TriggerCron][${requestId}] Flushed launch ${activeLaunch.date}:`, flushResult);
          
          results.flushPrevious = {
            success: flushResult.success,
            message: flushResult.message,
            launchDate: activeLaunch.date,
            voteCounts: flushResult.voteCounts
          };
          
          // Trigger revalidation after flushing
          if (flushResult.success) {
            await revalidateExternal('/launch');
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
      console.error(`[TriggerCron][${requestId}] Error flushing previous launch:`, error);
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
          
          console.log(`[TriggerCron][${requestId}] Created new launch for ${today} with ${appIds.length} apps`);
          
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
          await revalidateExternal('/launch');
          
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
      console.error(`[TriggerCron][${requestId}] Error creating new launch:`, error);
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

    console.log(`[TriggerCron][${requestId}] Manual daily cycle completed. Success: ${results.cycleComplete}`);

    const response = {
      success: results.cycleComplete,
      message: results.cycleComplete 
        ? 'Manual daily launch cycle completed successfully'
        : 'Manual daily launch cycle completed with some errors',
      results,
      triggeredAt: timestamp,
      nextScheduledCycle: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    console.log(`[TriggerCron][${requestId}][END] Request completed in ${Date.now() - new Date(timestamp).getTime()}ms`);

    return NextResponse.json(response, { 
      status: results.cycleComplete ? 200 : 500,
      headers: buildCorsHeaders(origin) 
    });
    
  } catch (error) {
    console.error(`[TriggerCron][${requestId}] Critical error in manual cycle:`, error);
    return NextResponse.json({
      success: false, 
      error: 'Critical failure in manual daily launch cycle',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { 
      status: 500, 
      headers: buildCorsHeaders(origin) 
    });
  }
}

export function OPTIONS(req: NextRequest) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}
