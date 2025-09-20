'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Alert as MuiAlert,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Switch,
  Divider,
  Tooltip
} from '@mui/material';
import RocketIcon from '@mui/icons-material/Rocket';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LaunchIcon from '@mui/icons-material/Launch';
import AppsIcon from '@mui/icons-material/Apps';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import SelectAllIcon from '@mui/icons-material/SelectAll';

interface App {
  _id: string;
  name: string;
  description?: string;
  totalVotes: number;
  launchDate?: string;
  url?: string;
}

interface CreateLaunchClientProps {
  availableApps: App[];
}

export default function CreateLaunchClient({ availableApps }: CreateLaunchClientProps) {
  const router = useRouter();
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [launchDate, setLaunchDate] = useState(new Date().toISOString().split('T')[0]);
  const [launchName, setLaunchName] = useState('');
  const [autoFlush, setAutoFlush] = useState(true);
  const [sendNotifications, setSendNotifications] = useState(false);
  const [allowLateVotes, setAllowLateVotes] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  const [confirmDialog, setConfirmDialog] = useState(false);

  // Filter apps based on search query
  const filteredApps = availableApps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (app.description && app.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Paginated apps
  const paginatedApps = filteredApps.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleSelectApp = (appId: string) => {
    const newSelected = new Set(selectedApps);
    if (newSelected.has(appId)) {
      newSelected.delete(appId);
    } else {
      newSelected.add(appId);
    }
    setSelectedApps(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedApps.size === filteredApps.length) {
      setSelectedApps(new Set());
    } else {
      setSelectedApps(new Set(filteredApps.map(app => app._id)));
    }
  };

  const handleClearAll = () => {
    setSelectedApps(new Set());
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreateLaunch = async () => {
    if (selectedApps.size === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one app for the launch',
        severity: 'warning'
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const response = await fetch('/api/admin/launches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: launchDate,
          appIds: Array.from(selectedApps),
          name: launchName.trim() || undefined,
          options: {
            autoFlush,
            sendNotifications,
            allowLateVotes
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create launch');
      }

      setSnackbar({
        open: true,
        message: 'Launch created successfully!',
        severity: 'success'
      });

      // Redirect to launches page after a short delay
      setTimeout(() => {
        router.push('/admin/launches');
      }, 1500);

    } catch (error) {
      console.error('Error creating launch:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to create launch',
        severity: 'error'
      });
    } finally {
      setIsCreating(false);
      setConfirmDialog(false);
    }
  };

  const selectedAppsList = availableApps.filter(app => selectedApps.has(app._id));

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
          Create New Launch
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Set up a new voting launch with selected apps
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Launch Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              avatar={<RocketIcon color="primary" />}
              title="Launch Configuration"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  label="Launch Date"
                  type="date"
                  value={launchDate}
                  onChange={(e) => setLaunchDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  helperText="Date when the voting launch will be active"
                />

                <TextField
                  label="Launch Name (Optional)"
                  value={launchName}
                  onChange={(e) => setLaunchName(e.target.value)}
                  placeholder="e.g., Weekly Product Hunt"
                  fullWidth
                  helperText="Custom name for this launch (defaults to date)"
                />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                    Launch Options
                  </Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoFlush}
                          onChange={(e) => setAutoFlush(e.target.checked)}
                        />
                      }
                      label="Auto-flush votes at end of day"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={sendNotifications}
                          onChange={(e) => setSendNotifications(e.target.checked)}
                        />
                      }
                      label="Send launch notifications"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={allowLateVotes}
                          onChange={(e) => setAllowLateVotes(e.target.checked)}
                        />
                      }
                      label="Allow votes after launch end"
                    />
                  </FormGroup>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Launch Preview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              avatar={<LaunchIcon color="primary" />}
              title="Launch Preview"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CalendarTodayIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2" fontWeight={600}>
                      Launch Date
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(launchDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Typography>
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Selected Apps
                    </Typography>
                    <Chip 
                      label={`${selectedApps.size} selected`} 
                      color={selectedApps.size > 0 ? 'primary' : 'default'}
                      size="small"
                    />
                  </Box>
                  {selectedApps.size > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selectedAppsList.slice(0, 3).map(app => (
                        <Chip
                          key={app._id}
                          label={app.name}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {selectedApps.size > 3 && (
                        <Chip
                          label={`+${selectedApps.size - 3} more`}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Select apps from the list below
                    </Typography>
                  )}
                </Box>

                <MuiAlert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Launch Rules
                  </Typography>
                  <Typography variant="caption" component="div">
                    • Each user can vote once per app<br />
                    • Votes expire after 25 hours<br />
                    • Launch auto-flushes at midnight<br />
                    • Results are immediately visible
                  </Typography>
                </MuiAlert>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* App Selection */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              avatar={<AppsIcon color="primary" />}
              title="Select Apps for Launch"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Select All Visible">
                    <IconButton onClick={handleSelectAll} size="small">
                      <SelectAllIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Clear Selection">
                    <IconButton onClick={handleClearAll} size="small">
                      <ClearIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            />
            <CardContent>
              {/* Search */}
              <TextField
                placeholder="Search apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Apps Table */}
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedApps.size > 0 && selectedApps.size < filteredApps.length}
                          checked={filteredApps.length > 0 && selectedApps.size === filteredApps.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>App Name</TableCell>
                      <TableCell align="right">Total Votes</TableCell>
                      <TableCell>Launch Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedApps.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            {searchQuery ? 'No apps match your search' : 'No apps available'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedApps.map((app) => (
                        <TableRow key={app._id} hover>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedApps.has(app._id)}
                              onChange={() => handleSelectApp(app._id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="subtitle2" fontWeight={600}>
                                {app.name}
                              </Typography>
                              {app.description && (
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {app.description}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Chip label={app.totalVotes} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            {app.launchDate ? (
                              <Chip
                                label={new Date(app.launchDate).toLocaleDateString()}
                                size="small"
                                color="secondary"
                                variant="outlined"
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                Not scheduled
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={filteredApps.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/admin/launches')}
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => setConfirmDialog(true)}
              disabled={selectedApps.size === 0 || isCreating}
              startIcon={isCreating ? undefined : <CheckCircleIcon />}
            >
              {isCreating ? 'Creating...' : 'Create Launch'}
            </Button>
          </Box>
          {isCreating && <LinearProgress sx={{ mt: 1 }} />}
        </Grid>
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)}>
        <DialogTitle>Confirm Launch Creation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to create a launch for {new Date(launchDate).toLocaleDateString()} 
            with {selectedApps.size} selected apps?
          </DialogContentText>
          {launchName && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Launch Name:</strong> {launchName}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateLaunch} variant="contained" disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Launch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <MuiAlert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
}
