import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { redis, voteKeys } from '@/lib/redis';
import { getActiveLaunch } from '@/lib/launches';
import { FlushStatus } from '@/components/flush-status';
import { SystemMaintenance } from '@/components/system-maintenance';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Typography,
  useTheme
} from '@mui/material';
import {
  Rocket,
  HowToVote as Vote,
  TrendingUp,
  People as Users,
  Storage as Database,
  Timeline as Activity,
  CalendarToday as Calendar,
  BarChart as BarChart3,
  ArrowForward as ArrowRight
} from '@mui/icons-material';

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
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 4 
      }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Voting System Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Overview of your voting system and launch management
          </Typography>
        </Box>
      </Box>

      {/* Launch Statistics */}
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
                {launchStats.totalLaunches}
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
                  <Activity fontSize="small" color="action" />
                </Box>
              }
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                {launchStats.activeLaunches}
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
                {launchStats.flushedLaunches}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Successfully completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Voting Activity */}
      {activeLaunch ? (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardHeader
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Current Votes
                    </Typography>
                    <Vote fontSize="small" color="action" />
                  </Box>
                }
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {votingStats.totalVotes}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active voting session
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
                      Apps in Launch
                    </Typography>
                    <Database fontSize="small" color="action" />
                  </Box>
                }
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {votingStats.activeApps}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Eligible for voting
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
                      Participants
                    </Typography>
                    <Users fontSize="small" color="action" />
                  </Box>
                }
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {votingStats.participatingUsers}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Unique voters
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            py: 6 
          }}>
            <Vote sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" component="h3" sx={{ fontWeight: 500, mb: 1 }}>
              No Active Launch
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
              Create a launch to start accepting votes
            </Typography>
            <Button 
              component={Link} 
              href="/admin/launches"
              variant="contained"
              startIcon={<Rocket />}
            >
              Manage Launches
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <Card 
            component={Link} 
            href="/admin/launches"
            sx={{ 
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': { boxShadow: 3 },
              transition: 'box-shadow 0.2s'
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Rocket sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Launches
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage voting launches
                </Typography>
              </Box>
              <ArrowRight color="action" />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={3}>
          <Card 
            component={Link} 
            href="/admin/voting"
            sx={{ 
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': { boxShadow: 3 },
              transition: 'box-shadow 0.2s'
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Vote sx={{ fontSize: 32, color: 'success.main', mr: 2 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Voting
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monitor live voting
                </Typography>
              </Box>
              <ArrowRight color="action" />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={3}>
          <Card 
            component={Link} 
            href="/admin/config"
            sx={{ 
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': { boxShadow: 3 },
              transition: 'box-shadow 0.2s'
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Database sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  System settings
                </Typography>
              </Box>
              <ArrowRight color="action" />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={3}>
          <Card sx={{ 
            cursor: 'pointer',
            '&:hover': { boxShadow: 3 },
            transition: 'box-shadow 0.2s'
          }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <BarChart3 sx={{ fontSize: 32, color: 'warning.main', mr: 2 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Analytics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View reports
                </Typography>
              </Box>
              <ArrowRight color="action" />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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

      {/* System Maintenance */}
      <SystemMaintenance 
        activeLaunch={activeLaunch ? {
          _id: activeLaunch._id?.toString(),
          date: activeLaunch.date,
          status: activeLaunch.status,
          apps: activeLaunch.apps
        } : null} 
      />

      {/* Recent Activity */}
      {activeLaunch && (
        <Card>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Calendar />
                <Typography variant="h6">Current Launch</Typography>
              </Box>
            }
          />
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  {new Date(activeLaunch.date).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {activeLaunch.apps.length} apps • {votingStats.totalVotes} votes
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={activeLaunch.status} 
                  color="success" 
                  variant="outlined"
                  size="small"
                />
                <Button 
                  component={Link} 
                  href="/admin/voting"
                  variant="outlined" 
                  size="small"
                >
                  View Details
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
