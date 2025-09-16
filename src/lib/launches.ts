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
export async function createLaunch(date: string, appIds: string[]): Promise<LaunchDocument> {
  const { db } = await connectToDatabase();
  
  // Check if launch already exists
  const existingLaunch = await db.collection('launches').findOne({ date });
  if (existingLaunch) {
    throw new Error(`Launch for ${date} already exists`);
  }
  
  // Ensure only one active launch at a time
  const activeLaunch = await db.collection('launches').findOne({ status: 'active' });
  if (activeLaunch) {
    throw new Error('Another launch is already active');
  }
  
  // Convert string IDs to ObjectIds
  const appObjectIds = appIds.map(id => new ObjectId(id));
  
  // Create launch document
  const launchDoc: LaunchDocument = {
    date,
    status: 'active',
    apps: appObjectIds,
    createdAt: new Date()
  };
  
  const result = await db.collection('launches').insertOne(launchDoc);
  
  // Initialize Redis keys atomically
  const multi = redis.multi();
  multi.del(voteKeys.launchApps);
  
  if (appIds.length > 0) {
    multi.sadd(voteKeys.launchApps, ...appIds);
    multi.expire(voteKeys.launchApps, 25 * 60 * 60); // 25 hours
    
    // Initialize vote counters
    appIds.forEach(appId => {
      multi.set(voteKeys.votes(appId), '0');
      multi.expire(voteKeys.votes(appId), 25 * 60 * 60);
    });
  }
  
  await multi.exec();
  
  return { ...launchDoc, _id: result.insertedId };
}

/**
 * Get the currently active launch
 */
export async function getActiveLaunch(): Promise<LaunchDocument | null> {
  const { db } = await connectToDatabase();
  
  const launch = await db.collection('launches').findOne({
    status: 'active'
  }) as LaunchDocument | null;
  
  return launch;
}

/**
 * Get launch status for voting validation
 */
export async function getLaunchStatus(): Promise<LaunchStatus> {
  const activeLaunch = await getActiveLaunch();
  
  if (!activeLaunch) {
    return {
      hasActiveLaunch: false,
      isFlushingInProgress: false
    };
  }
  
  return {
    hasActiveLaunch: true,
    isFlushingInProgress: activeLaunch.status === 'flushing',
    activeLaunchDate: activeLaunch.date
  };
}

/**
 * Check if an app is eligible for voting in the active launch
 */
export async function isAppInActiveLaunch(appId: string): Promise<boolean> {
  try {
    const isMember = await redis.sismember(voteKeys.launchApps, appId);
    return isMember === 1;
  } catch (error) {
    console.error('[Launches] Error checking app eligibility:', error);
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
          { $inc: { totalVotes: count } }
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
 * Get launch by date
 */
export async function getLaunchByDate(date: string): Promise<LaunchDocument | null> {
  const { db } = await connectToDatabase();
  
  const launch = await db.collection('launches').findOne({ date }) as LaunchDocument | null;
  
  return launch;
}
