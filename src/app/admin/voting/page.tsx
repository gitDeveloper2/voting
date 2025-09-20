import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { redis, voteKeys } from '@/lib/redis';
import { getActiveLaunch } from '@/lib/launches';
import { FlushStatus } from '@/components/flush-status';
import { ObjectId } from 'mongodb';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  LinearProgress,
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
  HowToVote as Vote,
  TrendingUp,
  People as Users,
  Schedule as Clock,
  Refresh as RefreshCw
} from '@mui/icons-material';

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
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 4 
      }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Voting Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor real-time voting activity and results
          </Typography>
        </Box>
        <Button variant="outlined" size="small" startIcon={<RefreshCw />}>
          Refresh
        </Button>
      </Box>

      {/* Launch Status */}
      <Card sx={{ mb: 4 }}>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Vote />
              <Typography variant="h6">Launch Status</Typography>
            </Box>
          }
        />
        <CardContent>
          {activeLaunch ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Active Launch
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {new Date(activeLaunch.date).toLocaleDateString()}
                </Typography>
              </Box>
              <Chip 
                label={activeLaunch.status} 
                color="success" 
                variant="outlined"
              />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Vote sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                No Active Launch
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create a launch to start voting
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {activeLaunch && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardHeader
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Total Votes
                    </Typography>
                    <TrendingUp fontSize="small" color="action" />
                  </Box>
                }
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {stats.totalVotes}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Current voting session
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
                      Active Apps
                    </Typography>
                    <Vote fontSize="small" color="action" />
                  </Box>
                }
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {stats.activeApps}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Apps in current launch
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
                  {stats.participatingUsers}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Unique voters
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Flush Status */}
      <FlushStatus 
        activeLaunch={activeLaunch ? {
          _id: activeLaunch._id?.toString(),
          date: activeLaunch.date,
          status: activeLaunch.status,
          apps: activeLaunch.apps,
          createdAt: activeLaunch.createdAt.toISOString()
        } : null} 
        votingStats={stats} 
      />

      {/* Voting Results Table */}
      {activeLaunch && (
        <Card>
          <CardHeader
            title={
              <Typography variant="h6">Real-time Voting Results</Typography>
            }
          />
          <CardContent>
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>App Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Current Votes</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Total Votes (All Time)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Vote Share</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {apps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          No apps in current launch
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    apps.map((app: any, index: number) => {
                      const voteShare = totalVotes > 0 ? ((app.currentVotes / totalVotes) * 100).toFixed(1) : '0';
                      return (
                        <TableRow key={app._id} hover>
                          <TableCell sx={{ fontWeight: 500 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {index === 0 && app.currentVotes > 0 && (
                                <Chip 
                                  label="#1" 
                                  size="small" 
                                  color="primary"
                                  variant="outlined"
                                />
                              )}
                              <Typography variant="body2">
                                {app.name || `App ${app._id.slice(-6)}`}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {app.currentVotes}
                              </Typography>
                              {app.currentVotes > 0 && (
                                <TrendingUp fontSize="small" color="success" />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {app.totalVotes}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={parseFloat(voteShare)}
                                sx={{ 
                                  width: 64, 
                                  height: 8,
                                  borderRadius: 1,
                                  backgroundColor: 'grey.200'
                                }}
                              />
                              <Typography variant="body2">
                                {voteShare}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Button variant="outlined" size="small">
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
