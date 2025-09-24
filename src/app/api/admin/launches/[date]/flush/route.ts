import {  NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { flushLaunchVotes, getLaunchByDate } from '@/lib/launches';
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
      console.warn('[Admin Flush] External revalidation failed', { status: res.status, statusText: res.statusText, data });
    }
  } catch (err) {
    console.warn('[Admin Flush] External revalidation error', err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  // Await params because they're typed as a Promise
  const { date } = await params;

  // Verify admin access
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify launch exists and is active
    const launch = await getLaunchByDate(date);
    if (!launch) {
      return NextResponse.json({ error: 'Launch not found' }, { status: 404 });
    }

    if (launch.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active launches can be flushed' },
        { status: 400 }
      );
    }

    // Flush the launch
    const result = await flushLaunchVotes(date);

    if (!result.success) {
      throw new Error(result.message || 'Failed to flush launch');
    }

    // Revalidate after flush
    await revalidateExternal('/launch');

    // Return updated launch info
    const updatedLaunch = await getLaunchByDate(date);
    return NextResponse.json({
      success: true,
      message: result.message,
      voteCounts: result.voteCounts,
      launch: updatedLaunch,
    });
  } catch (error) {
    console.error(`Failed to flush launch ${date}:`, error);
    return NextResponse.json(
      {
        error: 'Failed to flush launch',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
