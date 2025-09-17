import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Rocket, Calendar, BarChart3, RefreshCw } from 'lucide-react';

async function getLaunches() {
  const { db } = await connectToDatabase();
  const launches = await db.collection('launches')
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  
  return launches.map(launch => ({
    ...launch,
    _id: launch._id.toString(),
    createdAt: launch.createdAt?.toISOString() || new Date().toISOString(),
    flushedAt: launch.flushedAt?.toISOString()
  }));
}

async function getLaunchStats() {
  const { db } = await connectToDatabase();
  
  const [totalLaunches, activeLaunches, flushedLaunches] = await Promise.all([
    db.collection('launches').countDocuments(),
    db.collection('launches').countDocuments({ status: 'active' }),
    db.collection('launches').countDocuments({ status: 'flushed' })
  ]);

  return { totalLaunches, activeLaunches, flushedLaunches };
}

export default async function LaunchesPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const [launches, stats] = await Promise.all([
    getLaunches(),
    getLaunchStats()
  ]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'flushing': return 'warning';
      case 'flushed': return 'info';
      case 'pending': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Launches</h2>
          <p className="text-muted-foreground">
            Manage voting launches and monitor their status
          </p>
        </div>
        <Link href="/admin/launches/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Launch
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Launches</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLaunches}</div>
            <p className="text-xs text-muted-foreground">All time launches</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Launches</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeLaunches}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.flushedLaunches}</div>
            <p className="text-xs text-muted-foreground">Successfully completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Launches Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Apps</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Flushed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {launches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No launches found. Create your first launch to get started.
                </TableCell>
              </TableRow>
            ) : (
              launches.map((launch: any) => (
                <TableRow key={launch._id}>
                  <TableCell className="font-medium">
                    {new Date(launch.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(launch.status) as any}>
                      {launch.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{launch.apps?.length || 0} apps</TableCell>
                  <TableCell>{new Date(launch.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {launch.flushedAt ? new Date(launch.flushedAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Link href={`/admin/launches/${launch._id}`}>
                      <Button variant="ghost" size="sm" className="h-8">
                        View
                      </Button>
                    </Link>
                    {launch.status === 'active' && (
                      <Button variant="ghost" size="sm" className="h-8">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
