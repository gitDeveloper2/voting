import { NextRequest, NextResponse } from 'next/server';
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from '@/utils/api';
import { decryptVotingToken } from '@/lib/decryption';
import { redis, voteKeys } from '@/lib/redis';

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

  const toolIds = await redis.smembers(voteKeys.activeToolsSet);
  const totalKeys = toolIds.map(voteKeys.totalVotes);
  const userKeys = toolIds.map((toolId) => voteKeys.userVoted(userId, toolId));

  const pipeline = redis.multi();
  totalKeys.forEach((k) => pipeline.get(k));
  userKeys.forEach((k) => pipeline.exists(k));
  const results = await pipeline.exec();

  if (!results) {
    return NextResponse.json({ error: 'Redis transaction failed' }, { status: 500, headers: buildCorsHeaders(origin) });
  }

  const totals: Record<string, number> = {};
  const userVotes: string[] = [];

  for (let i = 0; i < toolIds.length; i++) {
    const [err, val] = results[i];
    if (!err) {
      const raw = val as string | null;
      totals[toolIds[i]] = parseInt(raw || '0', 10);
    }
  }

  for (let i = 0; i < toolIds.length; i++) {
    const [err, exists] = results[toolIds.length + i];
    if (!err && exists === 1) {
      userVotes.push(toolIds[i]);
    }
  }

  const res = NextResponse.json({ totals, userVotes });
  Object.entries(buildCorsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export function OPTIONS(req: NextRequest) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
}

