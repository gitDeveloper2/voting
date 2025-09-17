import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();
    
    if (!path) {
      return NextResponse.json(
        { success: false, error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    // Revalidate the specified path
    revalidatePath(path);
    
    console.log(`[Revalidation] Successfully revalidated path: ${path}`);
    
    return NextResponse.json({
      success: true,
      message: `Path ${path} revalidated successfully`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Revalidation] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to revalidate path',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  
  if (!path) {
    return NextResponse.json(
      { success: false, error: 'Path parameter is required' },
      { status: 400 }
    );
  }

  try {
    revalidatePath(path);
    
    console.log(`[Revalidation] Successfully revalidated path: ${path}`);
    
    return NextResponse.json({
      success: true,
      message: `Path ${path} revalidated successfully`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Revalidation] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to revalidate path',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
