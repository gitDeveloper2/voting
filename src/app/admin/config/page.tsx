import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { redis } from '@/lib/redis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Server, 
  Settings, 
  Clock, 
  Globe, 
  Key,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

async function getSystemStatus() {
  try {
    // Test Redis connection
    const redisStatus = await redis.ping();
    const redisInfo = await redis.info('server');
    
    // Get Redis memory usage
    const memoryInfo = await redis.info('memory');
    const memoryUsed = memoryInfo.match(/used_memory_human:(.+)/)?.[1]?.trim() || 'Unknown';
    
    // Count active vote keys
    const voteKeys = await redis.keys('votes:*');
    const userVoteKeys = await redis.keys('user:*:vote:*');
    
    return {
      redis: {
        status: redisStatus === 'PONG' ? 'connected' : 'disconnected',
        memoryUsed,
        activeVoteKeys: voteKeys.length,
        activeUserVotes: userVoteKeys.length,
        uptime: redisInfo.match(/uptime_in_seconds:(\d+)/)?.[1] || '0'
      }
    };
  } catch (error) {
    return {
      redis: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        memoryUsed: 'Unknown',
        activeVoteKeys: 0,
        activeUserVotes: 0,
        uptime: '0'
      }
    };
  }
}

function formatUptime(seconds: string) {
  const secs = parseInt(seconds, 10);
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default async function ConfigPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const systemStatus = await getSystemStatus();

  const envVars = [
    { name: 'MAIN_MONGODB_URI', value: process.env.MAIN_MONGODB_URI ? '✓ Set' : '✗ Missing', sensitive: true },
    { name: 'MONGODB_DATABASE', value: process.env.MONGODB_DATABASE || 'basicutils' },
    { name: 'REDIS_URL', value: process.env.REDIS_URL ? '✓ Set' : '✗ Missing', sensitive: true },
    { name: 'ADMIN_PASSWORD', value: process.env.ADMIN_PASSWORD ? '✓ Set' : '✗ Missing', sensitive: true },
    { name: 'NEXTAUTH_SECRET', value: process.env.NEXTAUTH_SECRET ? '✓ Set' : '✗ Missing', sensitive: true },
    { name: 'NEXTAUTH_URL', value: process.env.NEXTAUTH_URL || 'http://localhost:3000' },
    { name: 'CORS_ORIGINS', value: process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'Not set' },
    { name: 'CRON_SECRET', value: process.env.CRON_SECRET ? '✓ Set' : '✗ Missing', sensitive: true },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Configuration</h2>
          <p className="text-muted-foreground">
            Monitor system health and manage configuration
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Status
        </Button>
      </div>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Redis Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection</span>
              <Badge variant={systemStatus.redis.status === 'connected' ? 'success' : 'destructive'}>
                {systemStatus.redis.status === 'connected' ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : (
                  <AlertTriangle className="w-3 h-3 mr-1" />
                )}
                {systemStatus.redis.status}
              </Badge>
            </div>
            
            {systemStatus.redis.status === 'connected' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm">{systemStatus.redis.memoryUsed}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uptime</span>
                  <span className="text-sm">{formatUptime(systemStatus.redis.uptime)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Vote Keys</span>
                  <span className="text-sm font-semibold">{systemStatus.redis.activeVoteKeys}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">User Vote Keys</span>
                  <span className="text-sm font-semibold">{systemStatus.redis.activeUserVotes}</span>
                </div>
              </>
            )}
            
            {systemStatus.redis.status === 'error' && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                Error: {systemStatus.redis.error}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Voting System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Vote Expiration</span>
              <span className="text-sm">25 hours</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Launch Auto-Creation</span>
              <Badge variant="success">
                <Clock className="w-3 h-3 mr-1" />
                Daily (Cron)
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Vote Flushing</span>
              <Badge variant="success">
                <Clock className="w-3 h-3 mr-1" />
                Daily (Cron)
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Revalidation</span>
              <Badge variant="success">
                <CheckCircle className="w-3 h-3 mr-1" />
                Enabled
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Environment Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {envVars.map((envVar) => (
              <div key={envVar.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium">{envVar.name}</span>
                <div className="flex items-center gap-2">
                  {envVar.sensitive ? (
                    <Badge variant={envVar.value.includes('✓') ? 'success' : 'destructive'}>
                      {envVar.value}
                    </Badge>
                  ) : (
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {envVar.value}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cron Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Cron Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
              <div>
                <h4 className="font-medium text-green-800">Daily Launch Cycle</h4>
                <p className="text-sm text-green-600">
                  Atomic operation: Flush previous day & create new launch
                </p>
                <div className="mt-2 text-xs text-green-600">
                  <div>• Flushes active launch votes to MongoDB</div>
                  <div>• Creates new launch with scheduled apps</div>
                  <div>• Triggers cache revalidation</div>
                </div>
              </div>
              <div className="text-right">
                <Badge className="bg-green-100 text-green-800">Daily 6 AM UTC</Badge>
                <p className="text-xs text-green-600 mt-1">/api/cron/daily-launch-cycle</p>
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Merged Cron System Active
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Replaced separate create/flush crons with single atomic operation for better reliability
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline" size="sm">
              <Database className="mr-2 h-4 w-4" />
              Clear Vote Cache
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Test Redis Connection
            </Button>
            <Button variant="outline" size="sm">
              <Globe className="mr-2 h-4 w-4" />
              Test Revalidation
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
