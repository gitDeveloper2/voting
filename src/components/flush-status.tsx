'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography
} from '@mui/material';
import {
  Refresh as RefreshCw,
  CheckCircle,
  Warning as AlertTriangle,
  Schedule as Clock,
  Storage as Database,
  TrendingUp,
  FlashOn as Zap
} from '@mui/icons-material';

interface FlushStatusProps {
  activeLaunch?: {
    _id?: string;
    date: string;
    status: string;
    apps: any[];
    createdAt: string;
  } | null;
  votingStats?: {
    totalVotes: number;
    activeApps: number;
    participatingUsers: number;
  };
}

export function FlushStatus({ activeLaunch, votingStats }: FlushStatusProps) {
  const [isManualFlushing, setIsManualFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<any>(null);

  const handleManualFlush = async () => {
    if (!activeLaunch) return;
    
    setIsManualFlushing(true);
    setFlushResult(null);
    
    try {
      const response = await fetch(`/api/admin/launches/${activeLaunch.date}/flush`, {
        method: 'POST',
      });
      
      const result = await response.json();
      setFlushResult(result);
      
      if (result.success) {
        // Refresh the page after successful flush
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      setFlushResult({
        success: false,
        error: 'Failed to flush launch',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsManualFlushing(false);
    }
  };

  const getStatusInfo = () => {
    if (!activeLaunch) {
      return {
        status: 'No Active Launch',
        description: 'No launch is currently active for voting',
        color: 'default' as const,
        icon: Clock
      };
    }

    switch (activeLaunch.status) {
      case 'active':
        return {
          status: 'Active Voting',
          description: 'Launch is accepting votes',
          color: 'success' as const,
          icon: TrendingUp
        };
      case 'flushing':
        return {
          status: 'Flushing Votes',
          description: 'Transferring votes to permanent storage',
          color: 'warning' as const,
          icon: RefreshCw
        };
      case 'flushed':
        return {
          status: 'Completed',
          description: 'Launch completed and votes saved',
          color: 'info' as const,
          icon: CheckCircle
        };
      default:
        return {
          status: 'Unknown',
          description: 'Launch status unknown',
          color: 'default' as const,
          icon: AlertTriangle
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Database />
            <Typography variant="h6">Vote Flushing Status</Typography>
          </Box>
        }
      />
      <CardContent>
        <Box sx={{ mb: 3 }}>
          {/* Current Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: '50%',
                  backgroundColor: `${statusInfo.color}.light`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <StatusIcon color={statusInfo.color === 'default' ? 'action' : statusInfo.color} />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  {statusInfo.status}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {statusInfo.description}
                </Typography>
              </Box>
            </Box>
            <Chip 
              label={activeLaunch?.status || 'none'}
              color={statusInfo.color}
              variant="outlined"
              size="small"
            />
          </Box>

          {/* Active Launch Details */}
          {activeLaunch && (
            <Grid container spacing={2} sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 2, mb: 3 }}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Launch Date
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {new Date(activeLaunch.date).toLocaleDateString()}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Apps in Launch
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {activeLaunch.apps.length}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Current Votes
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {votingStats?.totalVotes || 0}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Participants
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {votingStats?.participatingUsers || 0}
                </Typography>
              </Grid>
            </Grid>
          )}

          {/* Flush Progress */}
          {activeLaunch?.status === 'flushing' && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Flushing Progress
                </Typography>
                <RefreshCw sx={{ fontSize: 16, animation: 'spin 1s linear infinite' }} color="warning" />
              </Box>
              <LinearProgress variant="determinate" value={75} sx={{ mb: 1 }} />
              <Typography variant="caption" color="text.secondary">
                Transferring votes from Redis to MongoDB...
              </Typography>
            </Box>
          )}

          {/* Manual Flush Controls */}
          {activeLaunch?.status === 'active' && (
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                    Manual Flush
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manually trigger vote flushing for this launch
                  </Typography>
                </Box>
                <Button
                  onClick={handleManualFlush}
                  disabled={isManualFlushing}
                  variant="outlined"
                  size="small"
                  startIcon={
                    isManualFlushing ? (
                      <RefreshCw sx={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Zap />
                    )
                  }
                >
                  {isManualFlushing ? 'Flushing...' : 'Flush Now'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Flush Result */}
          {flushResult && (
            <Alert 
              severity={flushResult.success ? 'success' : 'error'}
              sx={{ mb: 3 }}
              icon={flushResult.success ? <CheckCircle /> : <AlertTriangle />}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                {flushResult.success ? 'Flush Successful!' : 'Flush Failed'}
              </Typography>
              <Typography variant="body2">{flushResult.message}</Typography>
              {flushResult.voteCounts && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Votes processed: {Object.keys(flushResult.voteCounts).length} apps
                </Typography>
              )}
            </Alert>
          )}

          {/* Automatic Flush Info */}
          <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Clock fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                Automatic Flushing
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Votes are automatically flushed daily by cron jobs:
            </Typography>
            <List dense sx={{ pl: 2 }}>
              <ListItem disablePadding>
                <ListItemText 
                  primary="• Morning: Create new launch & flush previous day"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText 
                  primary="• Evening: Flush active launch votes"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText 
                  primary="• Every 6 hours: Combined launch management"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            </List>
          </Alert>
        </Box>
      </CardContent>
    </Card>
  );
}
