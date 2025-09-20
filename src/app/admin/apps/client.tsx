'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  CardHeader, 
  Grid,
  IconButton, 
  InputAdornment, 
  Paper, 
  Stack,
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TextField, 
  Typography,
  Chip,
  TablePagination,
  LinearProgress,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { 
  HowToVote as VoteIcon, 
  CalendarToday as CalendarIcon, 
  TrendingUp as TrendingUpIcon, 
  Search as SearchIcon, 
  Add as PlusIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  OpenInNew as ExternalLinkIcon
} from '@mui/icons-material';

// Client component that handles the UI
export default function AppsPageClient({ initialData }: { initialData: any }) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);

  const { apps, stats, pagination } = data;

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    // In a real app, you would fetch new data here
    router.push(`/admin/apps?page=${newPage + 1}&limit=${rowsPerPage}`);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    router.push(`/admin/apps?page=1&limit=${newRowsPerPage}`);
  };

  const getStatusBadge = (app: any) => {
    if (app.currentVotes > 0) {
      return <Chip label="Voting" color="success" size="small" variant="outlined" />;
    }
    if (app.launchDate) {
      const today = new Date().toISOString().split('T')[0];
      if (app.launchDate === today) {
        return <Chip label="Today's Launch" color="warning" size="small" variant="outlined" />;
      }
      if (app.launchDate > today) {
        return <Chip label="Scheduled" color="info" size="small" variant="outlined" />;
      }
      return <Chip label="Past Launch" color="default" size="small" variant="outlined" />;
    }
    return <Chip label="Not Scheduled" size="small" variant="outlined" />;
  };

  // Filter apps based on search query and active filter
  const filteredApps = apps.filter((app: any) => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.description && app.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filter === 'scheduled') return matchesSearch && app.launchDate;
    if (filter === 'voting') return matchesSearch && app.currentVotes > 0;
    return matchesSearch;
  });

  // Pagination
  const paginatedApps = filteredApps.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Stats cards data
  const statCards = [
    { 
      title: 'Total Apps', 
      value: stats.totalApps, 
      description: 'Registered apps',
      icon: <VoteIcon color="action" fontSize="small" />
    },
    { 
      title: 'Scheduled', 
      value: stats.appsWithLaunchDate, 
      description: 'Have launch dates',
      icon: <CalendarIcon color="action" fontSize="small" />
    },
    { 
      title: 'Total Votes', 
      value: stats.totalVotesAllTime, 
      description: 'All time votes',
      icon: <TrendingUpIcon color="action" fontSize="small" />
    },
    { 
      title: 'Currently Voting', 
      value: stats.currentVotingApps, 
      description: 'Active in voting',
      icon: <VoteIcon color="action" fontSize="small" />
    }
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: 4 
      }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5 }}>
            App Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage apps eligible for voting launches
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          color="primary"
          startIcon={<PlusIcon />}
          onClick={() => router.push('/admin/apps/new')}
          sx={{ minWidth: 'fit-content' }}
        >
          Add App
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%', borderRadius: 2, boxShadow: theme.shadows[1] }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {stat.title}
                  </Typography>
                  <Box sx={{ color: 'action.active' }}>
                    {stat.icon}
                  </Box>
                </Box>
                <Typography variant="h5" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stat.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Search and Filters */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        gap: 2, 
        mb: 3,
        alignItems: { xs: 'stretch', sm: 'center' }
      }}>
        <TextField
          size="small"
          placeholder="Search apps..."
          variant="outlined"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ 
            width: { xs: '100%', sm: 300 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button 
            variant={filter === 'all' ? 'contained' : 'outlined'} 
            size="small"
            onClick={() => setFilter('all')}
          >
            All Apps
          </Button>
          <Button 
            variant={filter === 'scheduled' ? 'contained' : 'outlined'} 
            size="small"
            onClick={() => setFilter('scheduled')}
          >
            Scheduled
          </Button>
          <Button 
            variant={filter === 'voting' ? 'contained' : 'outlined'} 
            size="small"
            onClick={() => setFilter('voting')}
          >
            Voting Now
          </Button>
        </Box>
      </Box>

      {/* Apps Table */}
      <Card elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <CardHeader 
          title="Apps Overview"
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        />
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>App Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Current Votes</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Total Votes</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Launch Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredApps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No apps found. Add your first app to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedApps.map((app: any, index: number) => (
                  <TableRow key={app._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {index < 3 && app.totalVotes > 0 && (
                          <Chip 
                            label={`#${index + 1}`} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {app.name || `App ${app._id.slice(-6)}`}
                          </Typography>
                          {app.description && (
                            <Typography 
                              variant="caption" 
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                maxWidth: 200
                              }}
                            >
                              {app.description}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(app)}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {app.currentVotes}
                        </Typography>
                        {app.currentVotes > 0 && (
                          <TrendingUpIcon fontSize="small" color="success" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {app.totalVotes}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {app.launchDate ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {new Date(app.launchDate).toLocaleDateString()}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not set
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        {app.url && (
                          <Tooltip title="Open in new tab">
                            <IconButton 
                              size="small"
                              component="a"
                              href={app.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton size="small">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredApps.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => handleChangePage(e, newPage)}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            '& .MuiTablePagination-toolbar': {
              justifyContent: 'space-between',
            },
            '& .MuiTablePagination-displayedRows': {
              margin: 0,
            },
          }}
        />
      </Card>

      {/* Quick Actions */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Bulk Actions" 
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
            />
            <CardContent>
              <Stack spacing={1}>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<CalendarIcon fontSize="small" />}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Set Launch Dates for Multiple Apps
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<VoteIcon fontSize="small" />}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Clear All Current Votes
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<TrendingUpIcon fontSize="small" />}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Export Vote Data
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Launch Management" 
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
            />
            <CardContent>
              <Stack spacing={1}>
                <Button 
                  component={Link}
                  href="/admin/launches"
                  variant="outlined" 
                  fullWidth 
                  startIcon={<CalendarIcon fontSize="small" />}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  View All Launches
                </Button>
                <Button 
                  component={Link}
                  href="/admin/voting"
                  variant="outlined" 
                  fullWidth 
                  startIcon={<VoteIcon fontSize="small" />}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Monitor Current Voting
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<PlusIcon fontSize="small" />}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Create Manual Launch
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
