'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Database,
  TrendingUp,
  Zap
} from 'lucide-react';

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
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        icon: Clock
      };
    }

    switch (activeLaunch.status) {
      case 'active':
        return {
          status: 'Active Voting',
          description: 'Launch is accepting votes',
          color: 'text-green-700',
          bgColor: 'bg-green-100',
          icon: TrendingUp
        };
      case 'flushing':
        return {
          status: 'Flushing Votes',
          description: 'Transferring votes to permanent storage',
          color: 'text-yellow-700',
          bgColor: 'bg-yellow-100',
          icon: RefreshCw
        };
      case 'flushed':
        return {
          status: 'Completed',
          description: 'Launch completed and votes saved',
          color: 'text-blue-700',
          bgColor: 'bg-blue-100',
          icon: CheckCircle
        };
      default:
        return {
          status: 'Unknown',
          description: 'Launch status unknown',
          color: 'text-gray-700',
          bgColor: 'bg-gray-100',
          icon: AlertTriangle
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Vote Flushing Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${statusInfo.bgColor}`}>
              <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
            </div>
            <div>
              <p className="font-medium">{statusInfo.status}</p>
              <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
            </div>
          </div>
          <Badge 
            variant={activeLaunch?.status === 'active' ? 'success' : 
                    activeLaunch?.status === 'flushing' ? 'warning' : 
                    activeLaunch?.status === 'flushed' ? 'info' : 'secondary'}
          >
            {activeLaunch?.status || 'none'}
          </Badge>
        </div>

        {/* Active Launch Details */}
        {activeLaunch && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-600">Launch Date</p>
              <p className="text-lg font-semibold">
                {new Date(activeLaunch.date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Apps in Launch</p>
              <p className="text-lg font-semibold">{activeLaunch.apps.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Current Votes</p>
              <p className="text-lg font-semibold">{votingStats?.totalVotes || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Participants</p>
              <p className="text-lg font-semibold">{votingStats?.participatingUsers || 0}</p>
            </div>
          </div>
        )}

        {/* Flush Progress */}
        {activeLaunch?.status === 'flushing' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Flushing Progress</span>
              <RefreshCw className="h-4 w-4 animate-spin text-yellow-600" />
            </div>
            <Progress value={75} className="w-full" />
            <p className="text-xs text-muted-foreground">
              Transferring votes from Redis to MongoDB...
            </p>
          </div>
        )}

        {/* Manual Flush Controls */}
        {activeLaunch?.status === 'active' && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Manual Flush</p>
                <p className="text-sm text-muted-foreground">
                  Manually trigger vote flushing for this launch
                </p>
              </div>
              <Button
                onClick={handleManualFlush}
                disabled={isManualFlushing}
                variant="outline"
                size="sm"
              >
                {isManualFlushing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Flushing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Flush Now
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Flush Result */}
        {flushResult && (
          <div className={`p-3 rounded-lg border ${
            flushResult.success 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {flushResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <p className="font-medium">
                {flushResult.success ? 'Flush Successful!' : 'Flush Failed'}
              </p>
            </div>
            <p className="text-sm mt-1">{flushResult.message}</p>
            {flushResult.voteCounts && (
              <div className="mt-2 text-xs">
                <p>Votes processed: {Object.keys(flushResult.voteCounts).length} apps</p>
              </div>
            )}
          </div>
        )}

        {/* Automatic Flush Info */}
        <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3 w-3" />
            <span className="font-medium">Automatic Flushing</span>
          </div>
          <p>Votes are automatically flushed daily by cron jobs:</p>
          <ul className="mt-1 ml-4 space-y-1">
            <li>• Morning: Create new launch & flush previous day</li>
            <li>• Evening: Flush active launch votes</li>
            <li>• Every 6 hours: Combined launch management</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
