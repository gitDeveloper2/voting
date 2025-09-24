/**
 * Utility function to call the revalidation API
 * Calls a single external endpoint defined by REVALIDATION_ENDPOINT
 * Example: https://main-app.example.com/api/revalidate
 */
export async function callRevalidationAPI(path: string): Promise<void> {
  try {
    // Use a single external endpoint for revalidation
    // If not provided, fall back to localhost for local development
    const revalidateUrl = process.env.REVALIDATION_ENDPOINT || 'http://localhost:3000/api/revalidate';
    
    console.log(`[Revalidation] Calling ${revalidateUrl} for path: ${path}`);
    
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
