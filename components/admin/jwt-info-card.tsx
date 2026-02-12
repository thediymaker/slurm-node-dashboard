"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RefreshCw, Key, AlertTriangle, CheckCircle, XCircle, Bell, BellOff } from "lucide-react";
import useSWR from "swr";
import { useState } from "react";

interface JWTInfo {
  configured: boolean;
  valid?: boolean;
  username?: string;
  description?: string | null;
  slackConfigured?: boolean;
  createdAt?: string;
  expiresAt?: string;
  isExpired?: boolean;
  expiresInSeconds?: number;
  daysUntilExpiry?: number;
  status?: 'valid' | 'warning' | 'critical' | 'expired';
  algorithm?: string;
  error?: string;
}

interface AlertResult {
  success: boolean;
  notificationSent?: boolean;
  message?: string;
  error?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Expired";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusBadge(status: JWTInfo['status']) {
  switch (status) {
    case 'expired':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Expired</Badge>;
    case 'critical':
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Critical</Badge>;
    case 'warning':
      return <Badge variant="default" className="gap-1 bg-orange-500 hover:bg-orange-600"><AlertTriangle className="h-3 w-3" />Warning</Badge>;
    case 'valid':
      return <Badge variant="outline" className="gap-1 text-green-600 border-green-600"><CheckCircle className="h-3 w-3" />Valid</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

export function JWTInfoCard() {
  const { data, isLoading, error, mutate } = useSWR<JWTInfo>('/api/slurm/jwt/info', fetcher, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: true
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTestingAlert, setIsTestingAlert] = useState(false);
  const [alertResult, setAlertResult] = useState<AlertResult | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  };

  const handleTestAlert = async () => {
    setIsTestingAlert(true);
    setAlertResult(null);
    try {
      const response = await fetch('/api/slurm/jwt/alert?force=true');
      const result = await response.json();
      setAlertResult(result);
    } catch (err) {
      setAlertResult({ success: false, error: 'Failed to send test alert' });
    } finally {
      setIsTestingAlert(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Token
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load token information</p>
        ) : !data?.configured ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="destructive">Not Configured</Badge>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              No SLURM API token is configured. Set the SLURM_API_TOKEN environment variable.
            </p>
          </div>
        ) : !data.valid ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="destructive">Invalid Token</Badge>
            </div>
            <Separator />
            <p className="text-sm text-destructive">
              The configured token is not a valid JWT format.
            </p>
          </div>
        ) : (
          <>
            {/* Status */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              {getStatusBadge(data.status)}
            </div>
            <Separator />

            {/* Username */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Username</span>
              <span className="font-mono text-sm">{data.username}</span>
            </div>
            <Separator />

            {/* Description */}
            {data.description && (
              <>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-sm text-muted-foreground">Description</span>
                  <span className="text-sm text-right max-w-[70%]">{data.description}</span>
                </div>
                <Separator />
              </>
            )}

            {/* Created Date */}
            {data.createdAt && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm">{formatDate(data.createdAt)}</span>
                </div>
                <Separator />
              </>
            )}

            {/* Expiration Date */}
            {data.expiresAt && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Expires</span>
                  <span className={`text-sm ${data.isExpired ? 'text-destructive' : ''}`}>
                    {formatDate(data.expiresAt)}
                  </span>
                </div>
                <Separator />
              </>
            )}

            {/* Time Remaining */}
            {data.expiresInSeconds !== null && data.expiresInSeconds !== undefined && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Time Remaining</span>
                  <span className={`text-sm font-medium ${
                    data.isExpired ? 'text-destructive' : 
                    data.status === 'critical' ? 'text-destructive' :
                    data.status === 'warning' ? 'text-orange-500' : ''
                  }`}>
                    {data.isExpired ? 'Expired' : formatTimeRemaining(data.expiresInSeconds)}
                    {data.daysUntilExpiry !== null && data.daysUntilExpiry !== undefined && !data.isExpired && (
                      <span className="text-muted-foreground font-normal ml-1">
                        ({data.daysUntilExpiry} days)
                      </span>
                    )}
                  </span>
                </div>
                <Separator />
              </>
            )}

            {/* Algorithm */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Algorithm</span>
              <span className="font-mono text-sm text-muted-foreground">{data.algorithm}</span>
            </div>

            {/* Warning message for expiring tokens */}
            {(data.status === 'warning' || data.status === 'critical') && (
              <>
                <Separator />
                <div className={`p-3 rounded-md ${
                  data.status === 'critical' ? 'bg-destructive/15 text-destructive' : 'bg-orange-500/15 text-orange-600'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">Token expiring soon</p>
                      <p className="text-xs mt-1 opacity-80">
                        Generate a new token using <code className="bg-background/50 px-1 rounded">scontrol token lifespan=&lt;days&gt;</code>
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {data.isExpired && (
              <>
                <Separator />
                <div className="p-3 rounded-md bg-destructive/15 text-destructive">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">Token has expired</p>
                      <p className="text-xs mt-1 opacity-80">
                        Generate a new token immediately to restore API access.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Test Alert Button */}
            <Separator />
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Slack Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {data.slackConfigured
                      ? "Test the expiry alert integration"
                      : "Set SLACK_WEBHOOK_URL to enable alerts"}
                  </p>
                </div>
                {data.slackConfigured && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestAlert}
                    disabled={isTestingAlert}
                    className="gap-2"
                  >
                    {isTestingAlert ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                    Test Alert
                  </Button>
                )}
              </div>
              {data.slackConfigured && alertResult && (
                <div className={`mt-3 p-2 rounded text-xs ${
                  alertResult.success && alertResult.notificationSent
                    ? 'bg-green-500/15 text-green-600'
                    : 'bg-destructive/15 text-destructive'
                }`}>
                  {alertResult.success && alertResult.notificationSent ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Alert sent successfully
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <BellOff className="h-3 w-3" /> {alertResult.error || 'Failed to send alert'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
