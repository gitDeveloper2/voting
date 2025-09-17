/**
 * Utility function to call the revalidation API
 * Uses CORS_ORIGINS or CORS_ORIGIN environment variable to determine main app domain
 */
export async function callRevalidationAPI(path: string): Promise<void> {
  try {
    // Determine the main app domain from CORS environment variables
    const corsOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
    let baseUrl = 'http://localhost:3000'; // Default fallback
    
    if (corsOrigins) {
      // Parse the first origin from CORS_ORIGINS
      const origins = corsOrigins.split(',').map(origin => origin.trim());
      if (origins.length > 0 && origins[0] !== '*') {
        baseUrl = origins[0];
      }
    }
    
    const revalidateUrl = `${baseUrl}/api/revalidate`;
    
    console.log(`[Revalidation] Calling revalidation API for path: ${path}`);
    console.log(`[Revalidation] Using base URL: ${baseUrl}`);
    
    const response = await fetch(revalidateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Revalidation API failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }
    
    const result = await response.json();
    console.log(`[Revalidation] Success:`, result);
    
  } catch (error) {
    console.error(`[Revalidation] Failed to revalidate path ${path}:`, error);
    // Don't throw the error - revalidation failure shouldn't break the main operation
  }
}

/**
 * Revalidate the launch page after vote operations
 */
export async function revalidateLaunchPage(): Promise<void> {
  await callRevalidationAPI('/launch');
}

/**
 * Revalidate multiple paths
 */
export async function revalidateMultiplePaths(paths: string[]): Promise<void> {
  const promises = paths.map(path => callRevalidationAPI(path));
  await Promise.allSettled(promises); // Use allSettled to not fail if one revalidation fails
}
