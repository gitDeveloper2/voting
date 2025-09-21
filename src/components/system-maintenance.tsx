'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Alert,
  AlertTitle,
  Chip,
  Grid,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  Build as Wrench,
  Schedule as Clock,
  Refresh as RefreshCw,
  CheckCircle as CheckCircle2,
  Warning as AlertTriangle,
  PlayArrow as Play
} from '@mui/icons-material';

interface SystemMaintenanceProps {
  activeLaunch?: {
    _id: string;
    date: string;
    status: string;
    apps: any[];
  } | null;
}

export function SystemMaintenance({ activeLaunch }: SystemMaintenanceProps) {
  const [repairLoading, setRepairLoading] = useState(false);
  const [cronLoading, setCronLoading] = useState(false);
  const [repairResult, setRepairResult] = useState<any>(null);
  const [cronResult, setCronResult] = useState<any>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const handleRepairRedis = async () => {
    setRepairLoading(true);
    setRepairResult(null);
    
    try {
      const response = await fetch('/api/admin/repair-redis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      setRepairResult(result);
      
      setSnackbar({
        open: true,
        message: result.success ? 'Redis repair completed successfully' : 'Redis repair failed',
        severity: result.success ? 'success' : 'error'
      });
    } catch (error) {
      setRepairResult({
        success: false,
        message: 'Failed to trigger repair',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      setSnackbar({
        open: true,
        message: 'Failed to trigger Redis repair',
        severity: 'error'
      });
    } finally {
      setRepairLoading(false);
    }
  };

  const handleTriggerCron = async () => {
    setCronLoading(true);
    setCronResult(null);
    
    try {
      const response = await fetch('/api/admin/trigger-cron', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      setCronResult(result);
      
      setSnackbar({
        open: true,
        message: result.success ? 'Daily launch cycle completed successfully' : 'Daily launch cycle failed',
        severity: result.success ? 'success' : 'error'
      });
    } catch (error) {
      setCronResult({
        success: false,
        message: 'Failed to trigger cron job',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      setSnackbar({
        open: true,
        message: 'Failed to trigger daily launch cycle',
        severity: 'error'
      });
    } finally {
      setCronLoading(false);
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Wrench />
        System Maintenance
      </Typography>

      <Grid container spacing={3}>
        {/* Redis Repair */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RefreshCw fontSize="small" />
                  <Typography variant="subtitle1">Redis Repair</Typography>
                </Box>
              }
            />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Sync Redis voting data with active MongoDB launch. Use this if voting fails due to data inconsistency.
              </Typography>
              
              {activeLaunch ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <AlertTitle>Active Launch Detected</AlertTitle>
                  Launch for {activeLaunch.date} with {activeLaunch.apps.length} apps
                </Alert>
              ) : (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <AlertTitle>No Active Launch</AlertTitle>
                  No active launch found in MongoDB
                </Alert>
              )}

              <Button
                variant="contained"
                onClick={handleRepairRedis}
                disabled={repairLoading}
                startIcon={repairLoading ? <CircularProgress size={16} /> : <Wrench />}
                fullWidth
              >
                {repairLoading ? 'Repairing...' : 'Repair Redis Data'}
              </Button>

              {repairResult && (
                <Alert 
                  severity={repairResult.success ? 'success' : 'error'} 
                  sx={{ mt: 2 }}
                >
                  <AlertTitle>
                    {repairResult.success ? 'Repair Successful' : 'Repair Failed'}
                  </AlertTitle>
                  {repairResult.message}
                  {repairResult.details && (
                    <Box sx={{ mt: 1, fontSize: '0.875rem' }}>
                      <strong>Details:</strong> {JSON.stringify(repairResult.details, null, 2)}
                    </Box>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Cron Job Management */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Clock fontSize="small" />
                  <Typography variant="subtitle1">Daily Launch Cycle</Typography>
                </Box>
              }
            />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Manually trigger the daily launch cycle. This flushes old launches and creates new ones.
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Automatic Schedule</AlertTitle>
                Runs daily at 6:00 AM UTC via Vercel cron
              </Alert>

              <Button
                variant="contained"
                color="secondary"
                onClick={handleTriggerCron}
                disabled={cronLoading}
                startIcon={cronLoading ? <CircularProgress size={16} /> : <Play />}
                fullWidth
              >
                {cronLoading ? 'Running...' : 'Trigger Daily Cycle'}
              </Button>

              {cronResult && (
                <Alert 
                  severity={cronResult.success ? 'success' : 'error'} 
                  sx={{ mt: 2 }}
                >
                  <AlertTitle>
                    {cronResult.success ? 'Cycle Completed' : 'Cycle Failed'}
                  </AlertTitle>
                  {cronResult.message}
                  {cronResult.results && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" display="block">
                        <strong>Flush Previous:</strong> {cronResult.results.flushPrevious?.message || 'N/A'}
                      </Typography>
                      <Typography variant="caption" display="block">
                        <strong>Create New:</strong> {cronResult.results.createNew?.message || 'N/A'}
                      </Typography>
                    </Box>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* System Status */}
      <Card sx={{ mt: 3 }}>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle2 fontSize="small" />
              <Typography variant="subtitle1">System Status</Typography>
            </Box>
          }
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Cron Authentication
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip 
                    label="No Secret Required" 
                    color="success" 
                    size="small"
                    icon={<CheckCircle2 fontSize="small" />}
                  />
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Auto-Repair
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip 
                    label="Enabled" 
                    color="success" 
                    size="small"
                    icon={<CheckCircle2 fontSize="small" />}
                  />
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Vercel Cron
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip 
                    label="6 AM UTC Daily" 
                    color="info" 
                    size="small"
                    icon={<Clock fontSize="small" />}
                  />
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Manual Override
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip 
                    label="Available" 
                    color="info" 
                    size="small"
                    icon={<Play fontSize="small" />}
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
