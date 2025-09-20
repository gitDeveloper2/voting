import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper
} from '@mui/material';
import {
  Add as Plus,
  Rocket,
  CalendarToday as Calendar,
  BarChart as BarChart3,
  Refresh as RefreshCw
} from '@mui/icons-material';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'flushing': return 'warning';
      case 'flushed': return 'info';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 4 
      }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Launches
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage voting launches and monitor their status
          </Typography>
        </Box>
        <Button 
          component={Link} 
          href="/admin/launches/new"
          variant="contained"
          startIcon={<Plus />}
        >
          Create Launch
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Launches
                  </Typography>
                  <Rocket fontSize="small" color="action" />
                </Box>
              }
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                {stats.totalLaunches}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                All time launches
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Active Launches
                  </Typography>
                  <Calendar fontSize="small" color="action" />
                </Box>
              }
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                {stats.activeLaunches}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Currently running
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Completed
                  </Typography>
                  <BarChart3 fontSize="small" color="action" />
                </Box>
              }
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                {stats.flushedLaunches}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Successfully completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Launches Table */}
      <Card>
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Apps</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Flushed</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {launches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No launches found. Create your first launch to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                launches.map((launch: any) => (
                  <TableRow key={launch._id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {new Date(launch.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={launch.status} 
                        color={getStatusColor(launch.status) as any}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{launch.apps?.length || 0} apps</TableCell>
                    <TableCell>{new Date(launch.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {launch.flushedAt ? new Date(launch.flushedAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button 
                          component={Link} 
                          href={`/admin/launches/${launch._id}`}
                          variant="outlined" 
                          size="small"
                        >
                          View
                        </Button>
                        {launch.status === 'active' && (
                          <Button variant="outlined" size="small">
                            <RefreshCw fontSize="small" />
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
