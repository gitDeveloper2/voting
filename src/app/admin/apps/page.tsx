import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { redis, voteKeys } from '@/lib/redis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Vote, 
  Calendar, 
  TrendingUp, 
  Search, 
  Plus,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react';

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

export default async function AppsPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const currentPage = parseInt(searchParams.page || '1', 10);
  const { apps, stats, pagination } = await getAppsData(currentPage, 10);

  const getStatusBadge = (app: any) => {
    if (app.currentVotes > 0) {
      return <Badge variant="success">Voting</Badge>;
    }
    if (app.launchDate) {
      const today = new Date().toISOString().split('T')[0];
      if (app.launchDate === today) {
        return <Badge variant="warning">Today's Launch</Badge>;
      }
      if (app.launchDate > today) {
        return <Badge variant="info">Scheduled</Badge>;
      }
      return <Badge variant="secondary">Past Launch</Badge>;
    }
    return <Badge variant="outline">Not Scheduled</Badge>;
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">App Management</h2>
          <p className="text-muted-foreground">
            Manage apps eligible for voting launches
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add App
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Apps</CardTitle>
            <Vote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalApps}</div>
            <p className="text-xs text-muted-foreground">Registered apps</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.appsWithLaunchDate}</div>
            <p className="text-xs text-muted-foreground">Have launch dates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVotesAllTime}</div>
            <p className="text-xs text-muted-foreground">All time votes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Voting</CardTitle>
            <Vote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.currentVotingApps}</div>
            <p className="text-xs text-muted-foreground">Active in voting</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search apps..."
            className="w-full pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            All Apps
          </Button>
          <Button variant="outline" size="sm">
            Scheduled
          </Button>
          <Button variant="outline" size="sm">
            Voting Now
          </Button>
        </div>
      </div>

      {/* Apps Table */}
      <Card>
        <CardHeader>
          <CardTitle>Apps Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Votes</TableHead>
                <TableHead>Total Votes</TableHead>
                <TableHead>Launch Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No apps found. Add your first app to get started.
                  </TableCell>
                </TableRow>
              ) : (
                apps.map((app: any, index: number) => (
                  <TableRow key={app._id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {index < 3 && app.totalVotes > 0 && (
                          <Badge variant="default" className="text-xs">
                            #{index + 1}
                          </Badge>
                        )}
                        <div>
                          <p className="font-medium">{app.name || `App ${app._id.slice(-6)}`}</p>
                          {app.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-48">
                              {app.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(app)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{app.currentVotes}</span>
                        {app.currentVotes > 0 && (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{app.totalVotes}</span>
                    </TableCell>
                    <TableCell>
                      {app.launchDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(app.launchDate).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {app.url && (
                          <Button variant="ghost" size="sm" className="h-8" asChild>
                            <a href={app.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
              {pagination.totalItems} apps
            </div>
            <div className="flex items-center space-x-2">
              <Link href={`/admin/apps?page=${Math.max(1, pagination.currentPage - 1)}`}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={pagination.currentPage === 1}
                >
                  Previous
                </Button>
              </Link>
              <span className="text-sm font-medium">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <Link href={`/admin/apps?page=${Math.min(pagination.totalPages, pagination.currentPage + 1)}`}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  Next
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              Set Launch Dates for Multiple Apps
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Vote className="mr-2 h-4 w-4" />
              Clear All Current Votes
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <TrendingUp className="mr-2 h-4 w-4" />
              Export Vote Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Launch Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/launches">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                View All Launches
              </Button>
            </Link>
            <Link href="/admin/voting">
              <Button variant="outline" className="w-full justify-start">
                <Vote className="mr-2 h-4 w-4" />
                Monitor Current Voting
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start">
              <Plus className="mr-2 h-4 w-4" />
              Create Manual Launch
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
