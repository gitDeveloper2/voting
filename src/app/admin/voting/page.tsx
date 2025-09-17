import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { redis, voteKeys } from '@/lib/redis';
import { getActiveLaunch } from '@/lib/launches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Vote, TrendingUp, Users, Clock, RefreshCw } from 'lucide-react';
import { ObjectId } from 'mongodb';

async function getVotingData() {
  const activeLaunch = await getActiveLaunch();
  
  if (!activeLaunch) {
    return {
      activeLaunch: null,
      apps: [],
      totalVotes: 0,
      stats: { totalVotes: 0, activeApps: 0, participatingUsers: 0 }
    };
  }

  const { db } = await connectToDatabase();
  
  // Get apps in the active launch
  const apps = await db.collection('userapps')
    .find({ _id: { $in: activeLaunch.apps } })
    .toArray();

  // Get real-time vote counts from Redis
  const appsWithVotes = await Promise.all(
    apps.map(async (app) => {
      const voteCount = await redis.get(voteKeys.votes(app._id.toString()));
      return {
        ...app,
        _id: app._id.toString(),
        currentVotes: parseInt(voteCount || '0', 10),
        totalVotes: app.totalVotes || 0
      };
    })
  );

  // Calculate stats
  const totalCurrentVotes = appsWithVotes.reduce((sum, app) => sum + app.currentVotes, 0);
  
  // Get unique voters count (approximate)
  const userVoteKeys = await redis.keys('user:*:vote:*');
  const uniqueVoters = new Set(
    userVoteKeys.map(key => key.split(':')[1])
  ).size;

  return {
    activeLaunch,
    apps: appsWithVotes.sort((a, b) => b.currentVotes - a.currentVotes),
    totalVotes: totalCurrentVotes,
    stats: {
      totalVotes: totalCurrentVotes,
      activeApps: appsWithVotes.length,
      participatingUsers: uniqueVoters
    }
  };
}

export default async function VotingPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const { activeLaunch, apps, totalVotes, stats } = await getVotingData();

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Voting Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor real-time voting activity and results
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Launch Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5" />
            Launch Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeLaunch ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Launch</p>
                <p className="text-lg font-semibold">{new Date(activeLaunch.date).toLocaleDateString()}</p>
              </div>
              <Badge variant="success" className="bg-green-100 text-green-800">
                {activeLaunch.status}
              </Badge>
            </div>
          ) : (
            <div className="text-center py-8">
              <Vote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No Active Launch</p>
              <p className="text-sm text-muted-foreground">Create a launch to start voting</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {activeLaunch && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVotes}</div>
              <p className="text-xs text-muted-foreground">Current voting session</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Apps</CardTitle>
              <Vote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeApps}</div>
              <p className="text-xs text-muted-foreground">Apps in current launch</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Participants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.participatingUsers}</div>
              <p className="text-xs text-muted-foreground">Unique voters</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Voting Results Table */}
      {activeLaunch && (
        <Card>
          <CardHeader>
            <CardTitle>Real-time Voting Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App Name</TableHead>
                  <TableHead>Current Votes</TableHead>
                  <TableHead>Total Votes (All Time)</TableHead>
                  <TableHead>Vote Share</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No apps in current launch
                    </TableCell>
                  </TableRow>
                ) : (
                  apps.map((app: any, index: number) => {
                    const voteShare = totalVotes > 0 ? ((app.currentVotes / totalVotes) * 100).toFixed(1) : '0';
                    return (
                      <TableRow key={app._id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {index === 0 && app.currentVotes > 0 && (
                              <Badge variant="default" className="text-xs">
                                #1
                              </Badge>
                            )}
                            {app.name || `App ${app._id.slice(-6)}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">{app.currentVotes}</span>
                            {app.currentVotes > 0 && (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{app.totalVotes}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${voteShare}%` }}
                              ></div>
                            </div>
                            <span className="text-sm">{voteShare}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-8">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
