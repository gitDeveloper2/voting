import { NextResponse } from 'next/server';
import { getPastLaunches, LaunchDocument, createLaunch } from '@/lib/launches';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidateLaunchPage } from '@/lib/revalidation';

export async function GET() {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  console.log(`[AdminLaunches][${requestId}][GET_START] ${timestamp} - Admin launches GET request`);
  
  // Verify admin access
  const session = await getServerSession(authOptions);
  
  console.log(`[AdminLaunches][${requestId}][AUTH]`, {
    hasSession: !!session,
    userEmail: session?.user?.email,
    userRole: session?.user?.role,
    isAdmin: session?.user?.role === 'admin'
  });
  
  if (session?.user?.role !== 'admin') {
    console.log(`[AdminLaunches][${requestId}][AUTH_FAIL] Unauthorized access attempt`);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log(`[AdminLaunches][${requestId}][FETCH] Getting past launches (limit: 100)...`);
    // Get all launches (past and current)
    const launches = await getPastLaunches(100); // Get up to 100 most recent launches
    
    console.log(`[AdminLaunches][${requestId}][RESULT] Found ${launches.length} launches`);
    
    // Log summary of launches
    const launchSummary = launches.map(launch => ({
      id: launch._id?.toString(),
      date: launch.date,
      status: launch.status,
      appsCount: launch.apps.length,
      manual: launch.manual || false,
      createdBy: launch.createdBy
    }));
    
    console.log(`[AdminLaunches][${requestId}][LAUNCHES_SUMMARY]`, launchSummary.slice(0, 5)); // Log first 5
    console.log(`[AdminLaunches][${requestId}][END] GET request completed in ${Date.now() - new Date(timestamp).getTime()}ms`);
    
    return NextResponse.json(launches);
  } catch (error) {
    console.error(`[AdminLaunches][${requestId}][ERROR] Failed to fetch launches:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch launches' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  console.log(`[AdminLaunches][${requestId}][POST_START] ${timestamp} - Admin launch creation request`);
  
  // Verify admin access
  const session = await getServerSession(authOptions);
  
  console.log(`[AdminLaunches][${requestId}][AUTH]`, {
    hasSession: !!session,
    userEmail: session?.user?.email,
    userRole: session?.user?.role,
    isAdmin: session?.user?.role === 'admin'
  });
  
  if (session?.user?.role !== 'admin') {
    console.log(`[AdminLaunches][${requestId}][AUTH_FAIL] Unauthorized launch creation attempt`);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log(`[AdminLaunches][${requestId}][PARSE_BODY] Parsing request body...`);
    const body = await request.json();
    
    console.log(`[AdminLaunches][${requestId}][REQUEST_BODY]`, {
      hasDate: !!body.date,
      date: body.date,
      hasAppIds: !!body.appIds,
      appIdsType: Array.isArray(body.appIds) ? 'array' : typeof body.appIds,
      appIdsCount: Array.isArray(body.appIds) ? body.appIds.length : 0,
      appIds: Array.isArray(body.appIds) ? body.appIds.slice(0, 10) : body.appIds, // Log first 10 app IDs
      hasName: !!body.name,
      name: body.name,
      hasOptions: !!body.options,
      options: body.options,
      fullBodyKeys: Object.keys(body),
      bodySize: JSON.stringify(body).length + ' bytes'
    });
    
    const { date, appIds, name, options } = body;

    // Validate required fields
    console.log(`[AdminLaunches][${requestId}][VALIDATION] Validating request data...`);
    
    if (!date || !appIds || !Array.isArray(appIds) || appIds.length === 0) {
      console.log(`[AdminLaunches][${requestId}][VALIDATION_FAIL] Missing required fields:`, {
        hasDate: !!date,
        hasAppIds: !!appIds,
        isAppIdsArray: Array.isArray(appIds),
        appIdsLength: Array.isArray(appIds) ? appIds.length : 0
      });
      return NextResponse.json(
        { error: 'Date and app IDs are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const launchDate = new Date(date);
    if (isNaN(launchDate.getTime())) {
      console.log(`[AdminLaunches][${requestId}][VALIDATION_FAIL] Invalid date format: ${date}`);
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }
    
    console.log(`[AdminLaunches][${requestId}][VALIDATION_OK] All validations passed`);

    // Create the launch
    const launchMetadata = {
      name: name || undefined,
      createdBy: session.user.email || 'admin',
      manual: true,
      options: options || {}
    };
    
    console.log(`[AdminLaunches][${requestId}][CREATE_LAUNCH] Creating launch with metadata:`, launchMetadata);
    
    const launch = await createLaunch(date, appIds, launchMetadata);

    console.log(`[AdminLaunches][${requestId}][LAUNCH_CREATED] Launch created successfully:`, {
      id: launch._id?.toString(),
      date: launch.date,
      status: launch.status,
      appsCount: launch.apps.length,
      createdBy: session.user.email
    });

    // Trigger revalidation
    console.log(`[AdminLaunches][${requestId}][REVALIDATION] Triggering launch page revalidation...`);
    await revalidateLaunchPage();
    console.log(`[AdminLaunches][${requestId}][REVALIDATION_DONE] Revalidation completed`);
    
    const responseData = {
      success: true,
      message: 'Launch created successfully',
      launch: {
        date: launch.date,
        status: launch.status,
        appsCount: launch.apps.length,
        createdAt: launch.createdAt,
        name: launch.name
      }
    };
    
    console.log(`[AdminLaunches][${requestId}][RESPONSE]`, responseData);
    console.log(`[AdminLaunches][${requestId}][END] POST request completed successfully in ${Date.now() - new Date(timestamp).getTime()}ms`);

    return NextResponse.json(responseData);

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
