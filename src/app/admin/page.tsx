import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { redis, voteKeys } from '@/lib/redis';
import { getActiveLaunch } from '@/lib/launches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlushStatus } from '@/components/flush-status';
import { 
  Rocket, 
  Vote, 
  TrendingUp, 
  Users, 
  Database,
  Activity,
  Calendar,
  BarChart3,
  ArrowRight
} from 'lucide-react';

async function getDashboardData() {
  const { db } = await connectToDatabase();
  
  // Get launch statistics
  const [totalLaunches, activeLaunches, flushedLaunches] = await Promise.all([
    db.collection('launches').countDocuments(),
    db.collection('launches').countDocuments({ status: 'active' }),
    db.collection('launches').countDocuments({ status: 'flushed' })
  ]);

  // Get active launch info
  const activeLaunch = await getActiveLaunch();
  
  // Get voting stats if there's an active launch
  let votingStats = { totalVotes: 0, activeApps: 0, participatingUsers: 0 };
  
  if (activeLaunch) {
    try {
      // Get current vote counts from Redis
      const voteKeys = await redis.keys('votes:*');
      const userVoteKeys = await redis.keys('user:*:vote:*');
      
      let totalVotes = 0;
      for (const key of voteKeys) {
        const count = await redis.get(key);
        totalVotes += parseInt(count || '0', 10);
      }
      
      const uniqueVoters = new Set(
        userVoteKeys.map(key => key.split(':')[1])
      ).size;
      
      votingStats = {
        totalVotes,
        activeApps: activeLaunch.apps.length,
        participatingUsers: uniqueVoters
      };
    } catch (error) {
      console.error('Error fetching voting stats:', error);
    }
  }

  // Get recent launches
  const recentLaunches = await db.collection('launches')
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  return {
    launchStats: { totalLaunches, activeLaunches, flushedLaunches },
    activeLaunch,
    votingStats,
    recentLaunches: recentLaunches.map(launch => ({
      ...launch,
      _id: launch._id.toString(),
      createdAt: launch.createdAt?.toISOString() || new Date().toISOString(),
      flushedAt: launch.flushedAt?.toISOString()
    }))
  };
}

export default async function AdminDashboard() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const { launchStats, activeLaunch, votingStats, recentLaunches } = await getDashboardData();

  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Voting System Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your voting system and launch management
          </p>
        </div>
      </div>

      {/* Launch Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Launches</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{launchStats.totalLaunches}</div>
            <p className="text-xs text-muted-foreground">All time launches</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Launches</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{launchStats.activeLaunches}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{launchStats.flushedLaunches}</div>
            <p className="text-xs text-muted-foreground">Successfully completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Voting Activity */}
      {activeLaunch ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Votes</CardTitle>
              <Vote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{votingStats.totalVotes}</div>
              <p className="text-xs text-muted-foreground">Active voting session</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Apps in Launch</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{votingStats.activeApps}</div>
              <p className="text-xs text-muted-foreground">Eligible for voting</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Participants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{votingStats.participatingUsers}</div>
              <p className="text-xs text-muted-foreground">Unique voters</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Vote className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Active Launch</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a launch to start accepting votes
            </p>
            <Link href="/admin/launches">
              <Button>
                <Rocket className="mr-2 h-4 w-4" />
                Manage Launches
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/launches">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center p-6">
              <Rocket className="h-8 w-8 text-blue-600 mr-4" />
              <div>
                <h3 className="font-medium">Launches</h3>
                <p className="text-sm text-muted-foreground">Manage voting launches</p>
              </div>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/admin/voting">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center p-6">
              <Vote className="h-8 w-8 text-green-600 mr-4" />
              <div>
                <h3 className="font-medium">Voting</h3>
                <p className="text-sm text-muted-foreground">Monitor live voting</p>
              </div>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/admin/config">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center p-6">
              <Database className="h-8 w-8 text-purple-600 mr-4" />
              <div>
                <h3 className="font-medium">Configuration</h3>
                <p className="text-sm text-muted-foreground">System settings</p>
              </div>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="flex items-center p-6">
            <BarChart3 className="h-8 w-8 text-orange-600 mr-4" />
            <div>
              <h3 className="font-medium">Analytics</h3>
              <p className="text-sm text-muted-foreground">View reports</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Flush Status */}
      <FlushStatus 
        activeLaunch={activeLaunch ? {
          _id: activeLaunch._id?.toString(),
          date: activeLaunch.date,
          status: activeLaunch.status,
          apps: activeLaunch.apps,
          createdAt: activeLaunch.createdAt.toISOString()
        } : null} 
        votingStats={votingStats} 
      />

      {/* Recent Activity */}
      {activeLaunch && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Current Launch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{new Date(activeLaunch.date).toLocaleDateString()}</p>
                <p className="text-sm text-muted-foreground">
                  {activeLaunch.apps.length} apps • {votingStats.totalVotes} votes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success" className="bg-green-100 text-green-800">
                  {activeLaunch.status}
                </Badge>
                <Link href="/admin/voting">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
