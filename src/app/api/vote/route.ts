import { decryptVotingToken } from '@/lib/decryption';
import { redis, voteKeys } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from '@/utils/api';
import { getLaunchStatus, isAppInActiveLaunch } from '@/lib/launches';

const getUserIdFromQuery = (req: NextRequest): string | null => {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    
    if (!token) {
      console.log('[Vote][AUTH] No token provided in request');
      return null;
    }
    
    console.log('[Vote][AUTH] Token found, attempting to decrypt...');
    const payload = decryptVotingToken(token);
    
    if (typeof payload.sub === 'string') {
      console.log(`[Vote][AUTH] Token decrypted successfully, userId: ${payload.sub}`);
      return payload.sub;
    } else {
      console.log('[Vote][AUTH] Token payload missing or invalid sub field:', typeof payload.sub);
      return null;
    }
  } catch (error) {
    console.log('[Vote][AUTH] Token decryption failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
};

export async function GET(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  console.log(`[Vote][${requestId}][START] ${timestamp} - New vote request`);
  
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  
  console.log(`[Vote][${requestId}][CORS] Origin: ${requestOrigin}, Resolved: ${origin}`);

  const userId = getUserIdFromQuery(req);
  if (!userId) {
    console.log(`[Vote][${requestId}][AUTH_FAIL] No valid user token provided`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: buildCorsHeaders(origin) });
  }
  
  console.log(`[Vote][${requestId}][AUTH_OK] User authenticated: ${userId}`);

  const { searchParams } = new URL(req.url);
  const toolId: string | undefined = searchParams.get('toolId') ?? searchParams.get('itemId') ?? undefined;
  if (!toolId) {
    console.log(`[Vote][${requestId}][PARAM_FAIL] Missing toolId/itemId parameter`);
    return NextResponse.json({ error: 'Missing itemId' }, { status: 400, headers: buildCorsHeaders(origin) });
  }
  
  console.log(`[Vote][${requestId}][PARAMS] UserId: ${userId}, ToolId: ${toolId}`);

  // Check launch status before allowing votes
  console.log(`[Vote][${requestId}][LAUNCH_CHECK] Checking launch status...`);
  const launchStatus = await getLaunchStatus();
  
  console.log(`[Vote][${requestId}][LAUNCH_STATUS]`, {
    hasActiveLaunch: launchStatus.hasActiveLaunch,
    isFlushingInProgress: launchStatus.isFlushingInProgress,
    activeLaunchDate: launchStatus.activeLaunchDate
  });
  
  if (!launchStatus.hasActiveLaunch) {
    console.log(`[Vote][${requestId}][LAUNCH_FAIL] No active launch available`);
    return NextResponse.json({ code: 'NO_ACTIVE_LAUNCH' }, { status: 400, headers: buildCorsHeaders(origin) });
  }
  
  if (launchStatus.isFlushingInProgress) {
    console.log(`[Vote][${requestId}][LAUNCH_FAIL] Launch is currently flushing - voting closed`);
    return NextResponse.json({ code: 'VOTING_CLOSED' }, { status: 400, headers: buildCorsHeaders(origin) });
  }
  
  console.log(`[Vote][${requestId}][LAUNCH_OK] Active launch available: ${launchStatus.activeLaunchDate}`);
  
  // Check if app is eligible for voting
  console.log(`[Vote][${requestId}][ELIGIBILITY_CHECK] Checking if app ${toolId} is eligible for voting...`);
  const isInActiveLaunch = await isAppInActiveLaunch(toolId);
  
  if (!isInActiveLaunch) {
    console.log(`[Vote][${requestId}][ELIGIBILITY_FAIL] App ${toolId} is not in active launch`);
    return NextResponse.json({ code: 'APP_NOT_ELIGIBLE' }, { status: 400, headers: buildCorsHeaders(origin) });
  }
  
  console.log(`[Vote][${requestId}][ELIGIBILITY_OK] App ${toolId} is eligible for voting`);

  const userKey = voteKeys.userVote(userId, toolId);
  const totalKey = voteKeys.votes(toolId);
  
  console.log(`[Vote][${requestId}][REDIS_KEYS] UserKey: ${userKey}, TotalKey: ${totalKey}`);

  const alreadyVoted = await redis.exists(userKey);
  console.log(`[Vote][${requestId}][VOTE_STATUS] User already voted: ${!!alreadyVoted}`);

  const actionParam = (searchParams.get('action') || '').toLowerCase();
  const unvoteParam = (searchParams.get('unvote') || '').toLowerCase();
  const isUnvote = actionParam === 'unvote' || unvoteParam === '1' || unvoteParam === 'true';
  
  console.log(`[Vote][${requestId}][ACTION] IsUnvote: ${isUnvote}, ActionParam: '${actionParam}', UnvoteParam: '${unvoteParam}'`);

  if (isUnvote) {
    console.log(`[Vote][${requestId}][UNVOTE_START] Processing unvote request`);
    
    if (!alreadyVoted) {
      const current = await redis.get(totalKey);
      const currentCount = parseInt(current || '0', 10);
      console.log(`[Vote][${requestId}][UNVOTE_FAIL] User hasn't voted yet. Current count: ${currentCount}`);
      return NextResponse.json({ error: 'Not voted', count: currentCount }, { status: 409, headers: buildCorsHeaders(origin) });
    }

    const current = await redis.get(totalKey);
    const currentCount = parseInt(current || '0', 10);
    const newCount = Math.max(0, currentCount - 1);
    
    console.log(`[Vote][${requestId}][UNVOTE_REDIS] Before: ${currentCount}, After: ${newCount}`);
    
    await redis.set(totalKey, newCount.toString());
    await redis.del(userKey);
    
    console.log(`[Vote][${requestId}][UNVOTE_SUCCESS] Vote removed successfully. Final count: ${newCount}`);
    return NextResponse.json({ count: newCount }, { status: 200, headers: buildCorsHeaders(origin) });
  }

  if (alreadyVoted) {
    const current = await redis.get(totalKey);
    const currentCount = parseInt(current || '0', 10);
    console.log(`[Vote][${requestId}][VOTE_FAIL] User already voted. Current count: ${currentCount}`);
    return NextResponse.json({ error: 'Already voted', count: currentCount }, { status: 409, headers: buildCorsHeaders(origin) });
  }

  // Vote
  console.log(`[Vote][${requestId}][VOTE_START] Processing new vote`);
  
  const before = parseInt((await redis.get(totalKey)) || '0', 10);
  console.log(`[Vote][${requestId}][VOTE_REDIS] Current count before vote: ${before}`);
  
  await redis.incr(totalKey);
  await redis.set(userKey, '1', 'EX', 25 * 60 * 60); // 25 hours
  
  const totalAfter = await redis.get(totalKey);
  const count = parseInt(totalAfter || '0', 10);
  
  console.log(`[Vote][${requestId}][VOTE_SUCCESS] Vote recorded successfully. Before: ${before}, After: ${count}`);
  console.log(`[Vote][${requestId}][END] Request completed successfully in ${Date.now() - new Date(timestamp).getTime()}ms`);

  return NextResponse.json({ count }, { status: 200, headers: buildCorsHeaders(origin) });
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
