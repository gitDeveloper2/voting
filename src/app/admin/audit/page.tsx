import { Box, Card, CardContent, CardHeader, Chip, Grid, Typography, Table, TableBody, TableCell, TableHead, TableRow, Divider, Tabs, Tab } from '@mui/material';
import Link from 'next/link';
import { getAuditLogs } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

function StatusChip({ status }: { status: string }) {
  const color = status === 'success' ? 'success' : status === 'error' ? 'error' : status === 'start' ? 'warning' : 'default';
  return <Chip size="small" color={color as any} label={status} variant={status === 'success' ? 'filled' : 'outlined'} />;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }
  const sp = await searchParams;
  const activeTab = sp?.tab || 'all';

  const [allLogs, cronLogs, revalLogs] = await Promise.all([
    getAuditLogs({ limit: 50 }),
    getAuditLogs({ type: 'cron', limit: 50 }),
    getAuditLogs({ type: 'revalidation', limit: 50 }),
  ]);

  const renderTable = (rows: any[]) => (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Time</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Name</TableCell>
          <TableCell>Route</TableCell>
          <TableCell>Path</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Message</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row._id} hover>
            <TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</TableCell>
            <TableCell><Chip size="small" label={row.type} /></TableCell>
            <TableCell>{row.name || '-'}</TableCell>
            <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.route || '-'}</TableCell>
            <TableCell>{row.path || '-'}</TableCell>
            <TableCell><StatusChip status={row.status} /></TableCell>
            <TableCell sx={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.message || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const tabContent = activeTab === 'cron' ? cronLogs : activeTab === 'revalidation' ? revalLogs : allLogs;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>System Audit</Typography>
          <Typography variant="body2" color="text.secondary">History of cron runs, revalidations and other events</Typography>
        </Box>
        <Link href="/admin">Back to Dashboard</Link>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardHeader title="Audit Feed" subheader="Most recent events (newest first)" />
        <CardContent>
          <Tabs value={activeTab} aria-label="audit-tabs">
            <Tab label="All" value="all" component={Link as any} href={`/admin/audit?tab=all`} />
            <Tab label="Crons" value="cron" component={Link as any} href={`/admin/audit?tab=cron`} />
            <Tab label="Revalidations" value="revalidation" component={Link as any} href={`/admin/audit?tab=revalidation`} />
          </Tabs>
          <Divider sx={{ my: 2 }} />
          {renderTable(tabContent)}
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Recent Cron Runs" />
            <CardContent>{renderTable(cronLogs)}</CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Recent Revalidations" />
            <CardContent>{renderTable(revalLogs)}</CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
