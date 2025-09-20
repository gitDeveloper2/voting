import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { redis, voteKeys } from '@/lib/redis';
import AppsPageClient from './client';
import { redirect } from 'next/navigation';

async function getAppsData(page: number = 1, limit: number = 20) {
  const { db } = await connectToDatabase();
  
  const skip = (page - 1) * limit;
  
  // Get total count for pagination
  const totalApps = await db.collection('userapps').countDocuments();
  
  // Get paginated apps
  const apps = await db.collection('userapps')
    .find({})
    .sort({ totalVotes: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  // Get current vote counts from Redis for apps
  const appsWithCurrentVotes = await Promise.all(
    apps.map(async (app) => {
      const currentVotes = await redis.get(voteKeys.votes(app._id.toString()));
      return {
        ...app,
        _id: app._id.toString(),
        currentVotes: parseInt(currentVotes || '0', 10),
        totalVotes: app.totalVotes || 0,
        launchDate: app.launchDate || null,
        createdAt: app.createdAt?.toISOString() || new Date().toISOString()
      };
    })
  );

  // Calculate statistics
  const appsWithLaunchDate = apps.filter(app => app.launchDate).length;
  const totalVotesAllTime = apps.reduce((sum, app) => sum + (app.totalVotes || 0), 0);
  const currentVotingApps = appsWithCurrentVotes.filter(app => app.currentVotes > 0).length;

  return {
    apps: appsWithCurrentVotes,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalApps / limit),
      totalItems: totalApps,
      itemsPerPage: limit
    },
    stats: {
      totalApps: totalApps,
      appsWithLaunchDate,
      totalVotesAllTime,
      currentVotingApps
    }
  };
}

// Server component that fetches data and renders client component
export default async function AppsPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ page?: string; limit?: string }> 
}) {
  // Check authentication
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Await searchParams since it's now a Promise in Next.js 15
  const params = await searchParams;
  
  // Get pagination params
  const page = parseInt(params.page || '1', 10);
  const limit = parseInt(params.limit || '20', 10);

  // Fetch data on server
  const data = await getAppsData(page, limit);

  // Render client component with data
  return <AppsPageClient initialData={data} />;
}
