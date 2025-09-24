import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get('type') || undefined; // 'cron' | 'revalidation' | ...
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam, 10) || 50)) : 50;

    const logs = await getAuditLogs({ type: typeParam as any, limit });

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('[Audit API] Failed to fetch audit logs', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
