import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getActiveLaunch, getCurrentVoteCounts } from '@/lib/launches';
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from '@/utils/api';

function todayUtcString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;  
}

export async function GET(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  console.log(`[LaunchToday][${requestId}][START] ${timestamp} - New launch/today request`);
  
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  
  console.log(`[LaunchToday][${requestId}][REQUEST]`, {
    origin: requestOrigin,
    resolvedOrigin: origin,
    userAgent: req.headers.get('user-agent'),
    method: req.method,
    url: req.url
  });

  try {
    const { db } = await connectToDatabase();
    const today = todayUtcString();
    
    console.log(`[LaunchToday][${requestId}][DATE] Today UTC: ${today}`);

    // VOTING API OWNS LAUNCHES: Get apps from active launch only
    console.log(`[LaunchToday][${requestId}][LAUNCH_CHECK] Getting active launch...`);
    const activeLaunch = await getActiveLaunch();
    
    if (!activeLaunch || activeLaunch.status !== 'active') {
      // No active launch = no apps launching today
      const emptyResponse = { 
        success: true, 
        date: today, 
        premium: [], 
        nonPremium: [] 
      };
      
      console.log(`[LaunchToday][${requestId}][NO_LAUNCH] No active launch found, returning empty response:`, emptyResponse);
      return NextResponse.json(emptyResponse, { headers: buildCorsHeaders(origin) });
    }
    
    console.log(`[LaunchToday][${requestId}][ACTIVE_LAUNCH] Found active launch:`, {
      id: activeLaunch._id?.toString(),
      date: activeLaunch.date,
      status: activeLaunch.status,
      appsCount: activeLaunch.apps.length,
      manual: activeLaunch.manual || false
    });

    // Get app details for active launch
    console.log(`[LaunchToday][${requestId}][DB_QUERY] Fetching app details for ${activeLaunch.apps.length} apps...`);
    
    const apps = await db.collection('userapps')
      .find({ 
        _id: { $in: activeLaunch.apps },
        status: 'approved'
      })
      .sort({ isPremium: -1, createdAt: -1 })
      .toArray();

    console.log(`[LaunchToday][${requestId}][DB_RESULT] Found ${apps.length} approved apps from ${activeLaunch.apps.length} launch apps`);
    
    // Get current vote counts from Redis
    const appIds = apps.map(app => app._id.toString());
    console.log(`[LaunchToday][${requestId}][CURRENT_VOTES] Fetching current vote counts from Redis...`);
    const currentVotes = await getCurrentVoteCounts(appIds);
    
    // Add current vote counts to each app
    const appsWithCurrentVotes = apps.map((app: any) => {
      const appId = app._id.toString();
      return {
        ...app,
        currentVotes: currentVotes[appId] || 0, // Current votes from Redis
        totalVotes: app.totalVotes || 0 // Historical total votes from MongoDB
      };
    });
    
    const premium = appsWithCurrentVotes.filter((a: any) => a.isPremium);
    const nonPremium = appsWithCurrentVotes.filter((a: any) => !a.isPremium);
    
    console.log(`[LaunchToday][${requestId}][CATEGORIZED] Premium: ${premium.length}, Non-Premium: ${nonPremium.length}`);
    
    // Log sample app data (first app from each category) with vote information
    if (premium.length > 0) {
      const samplePremium = premium[0];
      console.log(`[LaunchToday][${requestId}][SAMPLE_PREMIUM]`, {
        id: samplePremium._id?.toString(),
        name: samplePremium.name,
        description: samplePremium.description?.substring(0, 100) + '...',
        isPremium: samplePremium.isPremium,
        currentVotes: samplePremium.currentVotes, // Current session votes
        totalVotes: samplePremium.totalVotes, // All-time votes
        status: samplePremium.status,
        createdAt: samplePremium.createdAt
      });
    }
    
    if (nonPremium.length > 0) {
      const sampleNonPremium = nonPremium[0];
      console.log(`[LaunchToday][${requestId}][SAMPLE_NON_PREMIUM]`, {
        id: sampleNonPremium._id?.toString(),
        name: sampleNonPremium.name,
        description: sampleNonPremium.description?.substring(0, 100) + '...',
        isPremium: sampleNonPremium.isPremium,
        currentVotes: sampleNonPremium.currentVotes, // Current session votes
        totalVotes: sampleNonPremium.totalVotes, // All-time votes
        status: sampleNonPremium.status,
        createdAt: sampleNonPremium.createdAt
      });
    }
    
    // Create voting snapshot object with app ID -> current Redis vote count mapping
    // This is the pure voting data from Redis, not historical DB data
    console.log(`[LaunchToday][${requestId}][SNAPSHOT_CREATE] Creating voting snapshot from Redis data...`);
    const snapshot: Record<string, number> = currentVotes; // Direct use of Redis vote counts
    
    console.log(`[LaunchToday][${requestId}][SNAPSHOT]`, {
      snapshotKeys: Object.keys(snapshot).length,
      isFromRedis: true,
      sampleSnapshot: Object.entries(snapshot).slice(0, 3).reduce((acc, [id, votes]) => {
        acc[id.substring(0, 8) + '...'] = votes;
        return acc;
      }, {} as Record<string, number>),
      totalSnapshotVotes: Object.values(snapshot).reduce((sum, votes) => sum + votes, 0)
    });
    
    const response = { 
      success: true, 
      date: today, 
      premium, 
      nonPremium,
      snapshot // Add snapshot object with appId -> currentVotes mapping
    };
    
    // Calculate vote statistics
    const totalCurrentVotes = [...premium, ...nonPremium].reduce((sum: number, app: any) => sum + app.currentVotes, 0);
    const totalHistoricalVotes = [...premium, ...nonPremium].reduce((sum: number, app: any) => sum + app.totalVotes, 0);
    
    console.log(`[LaunchToday][${requestId}][VOTE_SUMMARY]`, {
      totalCurrentVotes,
      totalHistoricalVotes,
      appsWithCurrentVotes: [...premium, ...nonPremium].filter((app: any) => app.currentVotes > 0).length,
      topCurrentVoteApp: [...premium, ...nonPremium]
        .sort((a: any, b: any) => b.currentVotes - a.currentVotes)[0]?.name || 'None',
      topCurrentVoteCount: [...premium, ...nonPremium]
        .sort((a: any, b: any) => b.currentVotes - a.currentVotes)[0]?.currentVotes || 0
    });
    
    console.log(`[LaunchToday][${requestId}][RESPONSE_SUMMARY]`, {
      success: true,
      date: today,
      premiumCount: premium.length,
      nonPremiumCount: nonPremium.length,
      totalApps: premium.length + nonPremium.length,
      totalCurrentVotes,
      totalHistoricalVotes,
      snapshotEntries: Object.keys(snapshot).length,
      responseSize: JSON.stringify(response).length + ' bytes'
    });
    
    console.log(`[LaunchToday][${requestId}][END] Request completed successfully in ${Date.now() - new Date(timestamp).getTime()}ms`);

    return NextResponse.json(response, { headers: buildCorsHeaders(origin) });
  } catch (e: any) {
    console.error('[VotingAPI] Launch today route error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500, headers: buildCorsHeaders(origin) });
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
