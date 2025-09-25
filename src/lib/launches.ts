import { connectToDatabase } from './mongodb';
import { ObjectId } from 'mongodb';
import { redis, voteKeys } from './redis';

export interface LaunchDocument {
  _id?: ObjectId;
  date: string;
  status: 'pending' | 'active' | 'flushing' | 'flushed';
  apps: ObjectId[];
  createdAt: Date;
  flushedAt?: Date;
  name?: string;
  createdBy?: string;
  manual?: boolean;
  options?: Record<string, any>;
}

export interface LaunchStatus {
  hasActiveLaunch: boolean;
  isFlushingInProgress: boolean;
  activeLaunchDate?: string;
}

export interface FlushResult {
  success: boolean;
  message: string;
  voteCounts?: Record<string, number>;
}

/**
 * Create a new launch with apps and initialize Redis keys
 */
export async function createLaunch(
  date: string, 
  appIds: string[], 
  metadata?: {
    name?: string;
    createdBy?: string;
    manual?: boolean;
    options?: Record<string, any>;
  }
): Promise<LaunchDocument> {
  console.log(`[Launches][CREATE] Starting launch creation for ${date} with ${appIds.length} apps`, {
    date,
    appIds: appIds.slice(0, 5), // Log first 5 app IDs for brevity
    totalApps: appIds.length,
    metadata
  });
  
  const { db } = await connectToDatabase();
  
  // Check if launch already exists
  console.log(`[Launches][CREATE] Checking for existing launch on ${date}...`);
  const existingLaunch = await db.collection('launches').findOne({ date });
  if (existingLaunch) {
    console.log(`[Launches][CREATE_FAIL] Launch already exists for ${date}:`, {
      id: existingLaunch._id?.toString(),
      status: existingLaunch.status
    });
    throw new Error(`Launch for ${date} already exists`);
  }
  
  // Ensure only one active launch at a time
  console.log('[Launches][CREATE] Checking for existing active launch...');
  const activeLaunch = await db.collection('launches').findOne({ status: 'active' });
  if (activeLaunch) {
    console.log('[Launches][CREATE_FAIL] Another launch is already active:', {
      id: activeLaunch._id?.toString(),
      date: activeLaunch.date,
      status: activeLaunch.status
    });
    throw new Error('Another launch is already active');
  }
  
  // Convert string IDs to ObjectIds
  console.log('[Launches][CREATE] Converting app IDs to ObjectIds...');
  const appObjectIds = appIds.map(id => new ObjectId(id));
  
  // Create launch document
  const launchDoc: LaunchDocument = {
    date,
    status: 'active',
    apps: appObjectIds,
    createdAt: new Date(),
    ...(metadata?.name && { name: metadata.name }),
    ...(metadata?.createdBy && { createdBy: metadata.createdBy }),
    ...(metadata?.manual !== undefined && { manual: metadata.manual }),
    ...(metadata?.options && { options: metadata.options })
  };
  
  console.log('[Launches][CREATE] Inserting launch document into MongoDB...', {
    date: launchDoc.date,
    status: launchDoc.status,
    appsCount: launchDoc.apps.length,
    manual: launchDoc.manual || false
  });
  
  const result = await db.collection('launches').insertOne(launchDoc);
  
  // Initialize Redis keys atomically
  console.log('[Launches][CREATE] Initializing Redis keys for voting...');
  const multi = redis.multi();
  multi.del(voteKeys.launchApps);
  
  if (appIds.length > 0) {
    console.log(`[Launches][CREATE] Adding ${appIds.length} apps to Redis eligible set: ${voteKeys.launchApps}`);
    multi.sadd(voteKeys.launchApps, ...appIds);
    multi.expire(voteKeys.launchApps, 25 * 60 * 60); // 25 hours
    
    // Initialize vote counters
    appIds.forEach(appId => {
      multi.set(voteKeys.votes(appId), '0');
      multi.expire(voteKeys.votes(appId), 25 * 60 * 60);
    });
    
    console.log(`[Launches][CREATE] Initialized vote counters for ${appIds.length} apps with 25-hour expiry`);
  } else {
    console.log('[Launches][CREATE] No apps to add to Redis - empty launch created');
  }
  
  await multi.exec();
  
  const finalLaunch = { ...launchDoc, _id: result.insertedId };
  console.log('[Launches][CREATE_SUCCESS] Launch created successfully:', {
    id: finalLaunch._id?.toString(),
    date: finalLaunch.date,
    status: finalLaunch.status,
    appsCount: finalLaunch.apps.length
  });
  
  return finalLaunch;
}

/**
 * Get the currently active launch
 */
export async function getActiveLaunch(): Promise<LaunchDocument | null> {
  console.log('[Launches][GET_ACTIVE] Querying database for active launch...');
  
  const { db } = await connectToDatabase();
  
  const launch = await db.collection('launches').findOne({
    status: 'active'
  }) as LaunchDocument | null;
  
  if (launch) {
    console.log(`[Launches][GET_ACTIVE] Found active launch:`, {
      id: launch._id?.toString(),
      date: launch.date,
      status: launch.status,
      appsCount: launch.apps.length,
      createdAt: launch.createdAt,
      manual: launch.manual || false
    });
  } else {
    console.log('[Launches][GET_ACTIVE] No active launch found');
  }
  
  return launch;
}

/**
 * Get launch status for voting validation
 */
export async function getLaunchStatus(): Promise<LaunchStatus> {
  console.log('[Launches][GET_STATUS] Getting launch status for voting validation...');
  
  const activeLaunch = await getActiveLaunch();
  
  if (!activeLaunch) {
    const status = {
      hasActiveLaunch: false,
      isFlushingInProgress: false
    };
    console.log('[Launches][GET_STATUS] No active launch - voting disabled:', status);
    return status;
  }
  
  const status = {
    hasActiveLaunch: true,
    isFlushingInProgress: activeLaunch.status === 'flushing',
    activeLaunchDate: activeLaunch.date
  };
  
  console.log('[Launches][GET_STATUS] Launch status determined:', status);
  return status;
}

/**
 * Check if an app is eligible for voting in the active launch
 * Includes automatic repair if Redis data is missing but MongoDB has active launch
 */
export async function isAppInActiveLaunch(appId: string): Promise<boolean> {
  try {
    console.log(`[Launches][ELIGIBILITY] Checking app ${appId} in Redis set: ${voteKeys.launchApps}`);
    
    const isMember = await redis.sismember(voteKeys.launchApps, appId);
    const isEligible = isMember === 1;
    
    console.log(`[Launches][ELIGIBILITY] App ${appId} eligibility result: ${isEligible} (Redis returned: ${isMember})`);
    
    // Additional debug: get all eligible apps for context
    const allEligibleApps = await redis.smembers(voteKeys.launchApps);
    console.log(`[Launches][ELIGIBILITY] Current eligible apps in launch: [${allEligibleApps.join(', ')}] (${allEligibleApps.length} total)`);
    
    // If Redis has no eligible apps, check if there's an active launch in MongoDB that needs repair
    if (allEligibleApps.length === 0) {
      console.log(`[Launches][ELIGIBILITY] Redis has no eligible apps - checking for active launch to repair...`);
      
      const activeLaunch = await getActiveLaunch();
      if (activeLaunch && activeLaunch.status === 'active') {
        console.log(`[Launches][ELIGIBILITY] Found active launch with ${activeLaunch.apps.length} apps - attempting automatic repair...`);
        
        const repairResult = await repairActiveLaunchRedis();
        if (repairResult.success) {
          console.log(`[Launches][ELIGIBILITY] Automatic repair successful - rechecking app eligibility...`);
          
          // Recheck eligibility after repair
          const newIsMember = await redis.sismember(voteKeys.launchApps, appId);
          const newIsEligible = newIsMember === 1;
          
          console.log(`[Launches][ELIGIBILITY] After repair - App ${appId} eligibility: ${newIsEligible} (Redis returned: ${newIsMember})`);
          return newIsEligible;
        } else {
          console.log(`[Launches][ELIGIBILITY] Automatic repair failed:`, repairResult.message);
        }
      } else {
        console.log(`[Launches][ELIGIBILITY] No active launch found in MongoDB - Redis state is correct`);
      }
    }
    
    return isEligible;
  } catch (error) {
    console.error(`[Launches][ELIGIBILITY_ERROR] Error checking app ${appId} eligibility:`, error);
    return false;
  }
}

/**
 * Get today's launch apps from database
 */
export async function getTodaysLaunchApps(): Promise<string[]> {
  const { db } = await connectToDatabase();
  
  // Get apps that have launchDate set to today
  const today = new Date().toISOString().split('T')[0];
  
  const apps = await db.collection('userapps').find({
    launchDate: today
  }).toArray();
  
  return apps.map(app => app._id.toString());
}

/**
 * Flush votes from Redis to MongoDB and mark launch as complete
 */
export async function flushLaunchVotes(date: string): Promise<FlushResult> {
  const { db } = await connectToDatabase();
  
  // Find the launch
  const launch = await db.collection('launches').findOne({ date }) as LaunchDocument | null;
  
  if (!launch) {
    throw new Error(`Launch not found for date: ${date}`);
  }
  
  if (launch.status === 'flushed') {
    return {
      success: true,
      message: 'Launch already flushed'
    };
  }
  
  // Set status to flushing to prevent new votes
  await db.collection('launches').updateOne(
    { date },
    { $set: { status: 'flushing' } }
  );
  
  try {
    const voteCounts: Record<string, number> = {};
    
    // Get all vote counts from Redis
    for (const appObjectId of launch.apps) {
      const appId = appObjectId.toString();
      const voteCount = await redis.get(voteKeys.votes(appId));
      const count = parseInt(voteCount || '0', 10);
      
      if (count > 0) {
        voteCounts[appId] = count;
        
        // Add votes to MongoDB totalVotes
        await db.collection('userapps').updateOne(
          { _id: appObjectId },
          {
            $inc: { totalVotes: count },
            $set: { lastLaunchedDate: date } // <-- only one field to mark launch
          }
        );
        
      }
    }
    
    // Clean up Redis keys
    const multi = redis.multi();
    multi.del(voteKeys.launchApps);
    
    for (const appObjectId of launch.apps) {
      const appId = appObjectId.toString();
      multi.del(voteKeys.votes(appId));
      // Clean user vote keys with pattern matching
      const userVotePattern = `user:*:vote:${appId}`;
      const userKeys = await redis.keys(userVotePattern);
      if (userKeys.length > 0) {
        multi.del(...userKeys);
      }
    }
    
    await multi.exec();
    
    // Mark launch as flushed
    await db.collection('launches').updateOne(
      { date },
      { 
        $set: { 
          status: 'flushed',
          flushedAt: new Date()
        }
      }
    );
    
    return {
      success: true,
      message: `Flushed ${Object.keys(voteCounts).length} apps with votes`,
      voteCounts
    };
    
  } catch (error) {
    // Revert status if flushing failed
    await db.collection('launches').updateOne(
      { date },
      { $set: { status: 'active' } }
    );
    
    throw error;
  }
}

/**
 * Get past launches (completed ones)
 */
export async function getPastLaunches(limit: number = 10): Promise<LaunchDocument[]> {
  const { db } = await connectToDatabase();
  
  const launches = await db.collection('launches')
    .find({ status: 'flushed' })
    .sort({ date: -1 })
    .limit(limit)
    .toArray() as LaunchDocument[];
  
  return launches;
}

/**
 * Get current vote counts from Redis for given app IDs
 */
export async function getCurrentVoteCounts(appIds: string[]): Promise<Record<string, number>> {
  console.log(`[Launches][GET_CURRENT_VOTES] Getting current vote counts for ${appIds.length} apps from Redis...`);
  
  const voteCounts: Record<string, number> = {};
  
  try {
    // Use MGET for single Redis command to get all vote counts efficiently
    const voteKeys_array = appIds.map(appId => voteKeys.votes(appId));
    
    console.log(`[Launches][GET_CURRENT_VOTES] Using MGET for efficient single Redis command:`, {
      keysToFetch: voteKeys_array.slice(0, 3).map(key => key.substring(0, 20) + '...'),
      totalKeys: voteKeys_array.length,
      command: 'MGET'
    });
    
    const results = await redis.mget(...voteKeys_array);
    
    if (results) {
      appIds.forEach((appId, index) => {
        const voteCount = parseInt(results[index] || '0', 10);
        voteCounts[appId] = voteCount;
      });
    }
    
    console.log(`[Launches][GET_CURRENT_VOTES] Retrieved current votes from Redis:`, {
      totalApps: appIds.length,
      appsWithVotes: Object.values(voteCounts).filter(count => count > 0).length,
      totalCurrentVotes: Object.values(voteCounts).reduce((sum, count) => sum + count, 0),
      dataSource: 'Redis voting session',
      sampleCounts: Object.entries(voteCounts).slice(0, 3).reduce((acc, [id, count]) => {
        acc[id.substring(0, 8) + '...'] = count;
        return acc;
      }, {} as Record<string, number>)
    });
    
    return voteCounts;
  } catch (error) {
    console.error('[Launches][GET_CURRENT_VOTES] Error fetching current vote counts:', error);
    // Return zero counts for all apps on error
    return appIds.reduce((acc, appId) => {
      acc[appId] = 0;
      return acc;
    }, {} as Record<string, number>);
  }
}

/**
 * Get launch by date
 */
export async function getLaunchByDate(date: string): Promise<LaunchDocument | null> {
  const { db } = await connectToDatabase();
  
  const launch = await db.collection('launches').findOne({ date }) as LaunchDocument | null;
  
  return launch;
}

/**
 * Repair Redis data for active launch - sync Redis with MongoDB
 * This fixes the issue where MongoDB has an active launch but Redis keys are missing/expired
 */
export async function repairActiveLaunchRedis(): Promise<{ success: boolean; message: string; details?: any }> {
  console.log('[Launches][REPAIR] Starting Redis repair for active launch...');
  
  try {
    // Get the active launch from MongoDB
    const activeLaunch = await getActiveLaunch();
    
    if (!activeLaunch) {
      console.log('[Launches][REPAIR] No active launch found in MongoDB - nothing to repair');
      return {
        success: true,
        message: 'No active launch found - Redis is correctly empty'
      };
    }
    
    console.log('[Launches][REPAIR] Found active launch to repair:', {
      id: activeLaunch._id?.toString(),
      date: activeLaunch.date,
      status: activeLaunch.status,
      appsCount: activeLaunch.apps.length
    });
    
    // Check current Redis state
    const currentEligibleApps = await redis.smembers(voteKeys.launchApps);
    console.log('[Launches][REPAIR] Current Redis state:', {
      eligibleAppsCount: currentEligibleApps.length,
      eligibleApps: currentEligibleApps.slice(0, 5) // Show first 5 for brevity
    });
    
    // Convert ObjectIds to strings for Redis
    const appIds = activeLaunch.apps.map(id => id.toString());
    
    // Check if Redis already has the correct data
    if (currentEligibleApps.length === appIds.length && 
        appIds.every(appId => currentEligibleApps.includes(appId))) {
      console.log('[Launches][REPAIR] Redis already has correct data - no repair needed');
      return {
        success: true,
        message: 'Redis already synchronized with active launch',
        details: {
          appsCount: appIds.length,
          redisAppsCount: currentEligibleApps.length
        }
      };
    }
    
    // Repair Redis data
    console.log('[Launches][REPAIR] Repairing Redis data...');
    const multi = redis.multi();
    
    // Clear existing data
    multi.del(voteKeys.launchApps);
    
    // Add apps to eligible set
    if (appIds.length > 0) {
      multi.sadd(voteKeys.launchApps, ...appIds);
      multi.expire(voteKeys.launchApps, 25 * 60 * 60); // 25 hours
      
      // Initialize vote counters if they don't exist
      for (const appId of appIds) {
        const voteKey = voteKeys.votes(appId);
        // Only set to 0 if key doesn't exist (to preserve existing votes)
        multi.set(voteKey, '0', 'NX');
        multi.expire(voteKey, 25 * 60 * 60);
      }
    }
    
    await multi.exec();
    
    // Verify repair
    const repairedEligibleApps = await redis.smembers(voteKeys.launchApps);
    
    console.log('[Launches][REPAIR] Repair completed:', {
      beforeAppsCount: currentEligibleApps.length,
      afterAppsCount: repairedEligibleApps.length,
      expectedAppsCount: appIds.length,
      success: repairedEligibleApps.length === appIds.length
    });
    
    return {
      success: true,
      message: `Successfully repaired Redis data for ${appIds.length} apps`,
      details: {
        launchId: activeLaunch._id?.toString(),
        launchDate: activeLaunch.date,
        appsRepaired: appIds.length,
        beforeCount: currentEligibleApps.length,
        afterCount: repairedEligibleApps.length
      }
    };
    
  } catch (error) {
    console.error('[Launches][REPAIR] Error during Redis repair:', error);
    return {
      success: false,
      message: `Redis repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
