import { NextResponse } from 'next/server';
import { getPastLaunches, LaunchDocument, createLaunch } from '@/lib/launches';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidateLaunchPage } from '@/lib/revalidation';

export async function GET() {
  // Verify admin access
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Get all launches (past and current)
    const launches = await getPastLaunches(100); // Get up to 100 most recent launches
    return NextResponse.json(launches);
  } catch (error) {
    console.error('Failed to fetch launches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch launches' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Verify admin access
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { date, appIds, name, options } = body;

    // Validate required fields
    if (!date || !appIds || !Array.isArray(appIds) || appIds.length === 0) {
      return NextResponse.json(
        { error: 'Date and app IDs are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const launchDate = new Date(date);
    if (isNaN(launchDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Create the launch
    const launch = await createLaunch(date, appIds, {
      name: name || undefined,
      createdBy: session.user.email || 'admin',
      manual: true,
      options: options || {}
    });

    console.log(`[Manual Launch] Created launch for ${date} with ${appIds.length} apps by ${session.user.email}`);

    // Trigger revalidation
    await revalidateLaunchPage();

    return NextResponse.json({
      success: true,
      message: 'Launch created successfully',
      launch: {
        date: launch.date,
        status: launch.status,
        appsCount: launch.apps.length,
        createdAt: launch.createdAt,
        name: launch.name
      }
    });

  } catch (error) {
    console.error('Failed to create launch:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'A launch already exists for this date' },
          { status: 409 }
        );
      }
      if (error.message.includes('Invalid app')) {
        return NextResponse.json(
          { error: 'One or more selected apps are invalid' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create launch' },
      { status: 500 }
    );
  }
}
