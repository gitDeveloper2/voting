import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getActiveLaunch } from '@/lib/launches';
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from '@/utils/api';

function todayUtcString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;  
}

export async function GET(req: NextRequest) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
  const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);

  try {
    const { db } = await connectToDatabase();
    const today = todayUtcString();

    // VOTING API OWNS LAUNCHES: Get apps from active launch only
    const activeLaunch = await getActiveLaunch();
    
    if (!activeLaunch || activeLaunch.status !== 'active') {
      // No active launch = no apps launching today
      return NextResponse.json({ 
        success: true, 
        date: today, 
        premium: [], 
        nonPremium: [] 
      }, { headers: buildCorsHeaders(origin) });
    }

    // Get app details for active launch
    const apps = await db.collection('userapps')
      .find({ 
        _id: { $in: activeLaunch.apps },
        status: 'approved'
      })
      .sort({ isPremium: -1, createdAt: -1 })
      .toArray();

    const premium = apps.filter(a => a.isPremium);
    const nonPremium = apps.filter(a => !a.isPremium);

    return NextResponse.json({ success: true, date: today, premium, nonPremium }, { headers: buildCorsHeaders(origin) });
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
