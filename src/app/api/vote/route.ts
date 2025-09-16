import { decryptVotingToken } from '@/lib/decryption';
import { redis, voteKeys } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from '@/utils/api';

const getUserIdFromQuery = (req: NextRequest): string | null => {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token) return null;
    const payload = decryptVotingToken(token);
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
};

export async function GET(req: NextRequest) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);

  const userId = getUserIdFromQuery(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: buildCorsHeaders(origin) });
  }

  const { searchParams } = new URL(req.url);
  const toolId: string | undefined = searchParams.get('toolId') ?? searchParams.get('itemId') ?? undefined;
  if (!toolId) {
    return NextResponse.json({ error: 'Missing itemId' }, { status: 400, headers: buildCorsHeaders(origin) });
  }

  const userKey = voteKeys.userVoted(userId, toolId);
  const totalKey = voteKeys.totalVotes(toolId);

  const alreadyVoted = await redis.exists(userKey);

  const actionParam = (searchParams.get('action') || '').toLowerCase();
  const unvoteParam = (searchParams.get('unvote') || '').toLowerCase();
  const isUnvote = actionParam === 'unvote' || unvoteParam === '1' || unvoteParam === 'true';

  if (isUnvote) {
    if (!alreadyVoted) {
      const current = await redis.get(totalKey);
      const currentCount = parseInt(current || '0', 10);
      console.log('[Vote][UNVOTE][noop]', { userId, toolId, reason: 'not_voted', currentCount });
      return NextResponse.json({ error: 'Not voted', count: currentCount }, { status: 409, headers: buildCorsHeaders(origin) });
    }

    const current = await redis.get(totalKey);
    const currentCount = parseInt(current || '0', 10);
    const newCount = Math.max(0, currentCount - 1);
    await redis.set(totalKey, newCount.toString());
    await redis.del(userKey);
    if (newCount === 0) {
      await redis.srem(voteKeys.activeToolsSet, toolId);
    }
    console.log('[Vote][UNVOTE][ok]', { userId, toolId, before: currentCount, after: newCount });
    return NextResponse.json({ count: newCount }, { status: 200, headers: buildCorsHeaders(origin) });
  }

  if (alreadyVoted) {
    const current = await redis.get(totalKey);
    const currentCount = parseInt(current || '0', 10);
    console.log('[Vote][VOTE][conflict]', { userId, toolId, currentCount });
    return NextResponse.json({ error: 'Already voted', count: currentCount }, { status: 409, headers: buildCorsHeaders(origin) });
  }

  // ✅ Vote
  const before = parseInt((await redis.get(totalKey)) || '0', 10);
  await redis.incr(totalKey);
  await redis.set(userKey, '1', 'EX', 7 * 24 * 60 * 60); // 7 days
  await redis.sadd(voteKeys.activeToolsSet, toolId);

  const totalAfter = await redis.get(totalKey);
  const count = parseInt(totalAfter || '0', 10);
  console.log('[Vote][VOTE][ok]', { userId, toolId, before, after: count });

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

