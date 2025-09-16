import { NextRequest, NextResponse } from 'next/server';
import { redis, voteKeys } from '@/lib/redis';
import { getVotingDayModel } from '@/models/VotingDay';
import { getMainConnection } from '@/lib/mainDb';
import mongoose from 'mongoose';
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from '@/utils/api';
import { connectToMongo } from '@/lib/mongoose';

function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date format');
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

async function handleFlush(req: NextRequest, body: any) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);

  await connectToMongo();

  const searchParams = new URL(req.url).searchParams;
  const debug = searchParams.get('debug') === '1' || body?.debug === true;
  const minutesParam = searchParams.get('minutes');
  const appIdsParam = searchParams.get('appIds');

  const date = body?.date || searchParams.get('date');
  const appIds: string[] | undefined = body?.appIds || (appIdsParam ? appIdsParam.split(',').map(s => s.trim()).filter(Boolean) : undefined);

  if (!date) {
    const res = NextResponse.json({ error: 'Missing date (YYYY-MM-DD)' }, { status: 400 });
    Object.entries(buildCorsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  try {
    const day = normalizeDate(date);
    const nowIso = new Date().toISOString();
    const overrideMins = Number(minutesParam ?? process.env.VOTING_FLUSH_AFTER_MINUTES ?? '0');

    if (debug) {
      console.log('[Flush][start]', { day, nowIso, appIdsLength: Array.isArray(appIds) ? appIds.length : 0, overrideMins });
    }

    const VotingDay = await getVotingDayModel();
    let existing = await VotingDay.findOne({ day });

    if (debug && existing) {
      console.log('[Flush][snapshot:existing]', { day, counts: existing.counts?.length || 0, closedAt: existing.closedAt });
    }

    const lockKey = `lock:voting:close:${day}`;
    const lock = await redis.set(lockKey, '1', 'EX', 60, 'NX');
    const lockAcquired = !!lock;
    if (debug) {
      console.log('[Flush][lock]', { lockKey, lockAcquired });
    }

    try {
      let counts: { toolId: string; votes: number }[] = [];

      if (!existing && lockAcquired) {
        let targetToolIds: string[] = Array.isArray(appIds) && appIds.length ? appIds : [];

        if (!targetToolIds.length) {
          try {
            const mainConn = await getMainConnection();
            const start = new Date(`${day}T00:00:00.000Z`);
            const end = new Date(`${day}T23:59:59.999Z`);
            const launched = await mainConn
              .collection('userapps')
              .find({ status: 'approved', launchDate: { $gte: start, $lte: end }, votingFlushed: { $ne: true } })
              .project({ _id: 1, launchDate: 1, votingDurationHours: 1 })
              .toArray();

            if (debug) {
              console.log('[Flush][launched:queried]', { count: launched.length, start: start.toISOString(), end: end.toISOString() });
            }

            const now = Date.now();
            const eligible = launched.filter((doc: any) => {
              const durationHrs = typeof doc.votingDurationHours === 'number' ? doc.votingDurationHours : 24;
              const customMs = overrideMins > 0 ? overrideMins * 60_000 : durationHrs * 3_600_000;
              const endTs = new Date(doc.launchDate).getTime() + customMs;
              const isEligible = now >= endTs;
              if (debug) {
                console.log('[Flush][eligibility]', {
                  toolId: String(doc._id),
                  launchDate: doc.launchDate,
                  durationHrs,
                  overrideMins,
                  endTs: new Date(endTs).toISOString(),
                  nowIso,
                  eligible: isEligible,
                });
              }
              return isEligible;
            });

            targetToolIds = (overrideMins > 0 ? eligible : launched).map((d) => String(d._id));
          } catch (err) {
            console.warn('[Flush] Could not query main DB for launched apps; falling back to active set.', err);
          }
        }

        if (!targetToolIds.length) {
          targetToolIds = await redis.smembers(voteKeys.activeToolsSet);
          if (debug) {
            console.log('[Flush][activeSet]', { count: targetToolIds.length });
          }
        }

        if (debug) {
          console.log('[Flush][targets]', { count: targetToolIds.length, sample: targetToolIds.slice(0, 10) });
        }

        const keys = targetToolIds.map(voteKeys.totalVotes);
        const pipeline = redis.multi();
        keys.forEach((k) => pipeline.get(k));
        const results = await pipeline.exec();

        counts = targetToolIds.map((id, idx) => {
          const tuple = results?.[idx];
          const raw = (tuple && (tuple as any)[1]) as string | null;
          const num = parseInt(raw || '0', 10);
          return { toolId: id, votes: Number.isFinite(num) ? num : 0 };
        });

        if (debug) {
          const totalVotes = counts.reduce((sum, c) => sum + (c.votes || 0), 0);
          console.log('[Flush][snapshot:pre]', { keys: keys.length, counts: counts.length, totalVotes });
        }

        existing = await VotingDay.create({
          day,
          counts,
          closedAt: new Date(),
          source: 'redis-snapshot',
        });

        if (debug) {
          console.log('[Flush][snapshot:created]', { day, counts: counts.length, id: existing._id?.toString() });
        }

        const delPipeline = redis.multi();
        keys.forEach((k) => delPipeline.del(k));
        if (targetToolIds.length) {
          delPipeline.srem(voteKeys.activeToolsSet, ...targetToolIds);
        }
        await delPipeline.exec();
        if (debug) {
          console.log('[Flush][redis:cleanup]', { deletedKeys: keys.length, removedFromActive: targetToolIds.length });
        }
      } else {
        if (!existing) {
          await new Promise((r) => setTimeout(r, 1000));
          existing = await VotingDay.findOne({ day });
          if (!existing) {
            const res = NextResponse.json({ error: 'Close in progress, try again' }, { status: 409 });
            Object.entries(buildCorsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
            return res;
          }
        }
        if (debug) {
          console.log('[Flush][snapshot:reuse]', { day, counts: existing.counts?.length || 0 });
        }
      }

      const snapshotCounts = existing!.counts;

      const MAIN_DB_URI = process.env.MAIN_MONGODB_URI;
      if (MAIN_DB_URI) {
        try {
          const mainConn = await getMainConnection();
          const start = new Date(`${day}T00:00:00.000Z`);
          const end = new Date(`${day}T23:59:59.999Z`);
          const launched = await mainConn
            .collection('userapps')
            .find({ status: 'approved', launchDate: { $gte: start, $lte: end } })
            .project({ _id: 1 })
            .toArray();
          const launchedIds = new Set(launched.map((d) => String(d._id)));

          const relevant = snapshotCounts.filter((c) => launchedIds.has(c.toolId));
          const ranked = [...relevant].sort((a, b) => b.votes - a.votes);
          const top3 = new Set(ranked.slice(0, 3).map((r) => r.toolId));

          if (debug) {
            console.log('[Flush][mainDb:prepare]', { launched: launched.length, relevant: relevant.length, top3: Array.from(top3) });
          }

          if (relevant.length) {
            const bulk = mainConn.collection('userapps').initializeUnorderedBulkOp();
            for (const r of relevant) {
              const objId = new mongoose.Types.ObjectId(r.toolId);
              bulk.find({ _id: objId }).updateOne({
                $set: {
                  likes: r.votes,
                  'stats.votes': r.votes,
                  finalVotes: r.votes,
                  votingFlushed: true,
                  dofollow: top3.has(r.toolId),
                  finalizedAt: new Date(),
                },
              });
            }
            const result = await bulk.execute();
            if (debug) {
              console.log('[Flush][mainDb:bulk:done]', { nModified: (result as any).nModified ?? undefined });
            }
          } else if (debug) {
            console.log('[Flush][mainDb:skip]', { reason: 'no relevant items' });
          }
        } catch (err) {
          console.error('[Flush] Failed to update main DB with final counts:', err);
        }
      } else if (debug) {
        console.log('[Flush][mainDb:disabled]', { reason: 'MAIN_DB_URI missing' });
      }

      const resBody: any = { success: true, day, counts: snapshotCounts };
      if (debug) {
        resBody.debug = { overrideMins, nowIso };
      }
      const res = NextResponse.json(resBody);
      Object.entries(buildCorsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    } finally {
      if (lockAcquired) {
        await redis.del(lockKey);
        if (debug) {
          console.log('[Flush][lock:released]', { lockKey });
        }
      }
    }
  } catch (e: any) {
    console.error('[Flush][error]', e);
    const res = NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
    return res;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handleFlush(req, body);
}

export async function GET(req: NextRequest) {
  return handleFlush(req, {});
}

export function OPTIONS(req: NextRequest) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  const res = NextResponse.json({});
  Object.entries(buildCorsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

