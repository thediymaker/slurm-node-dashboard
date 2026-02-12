export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { env } from "process";

interface JWTPayload {
  exp?: number;
  iat?: number;
  sun?: string;
  [key: string]: unknown;
}

/**
 * Decode a JWT token without verification (for reading metadata only)
 */
function decodeJWT(token: string): { header: Record<string, unknown>; payload: JWTPayload } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const base64UrlDecode = (str: string): string => {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      return Buffer.from(padded, 'base64').toString('utf8');
    };

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    return { header, payload };
  } catch (error) {
    return null;
  }
}

/**
 * Send a Slack notification using a webhook URL
 */
async function sendSlackNotification(webhookUrl: string, message: {
  text: string;
  blocks?: Array<{
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    fields?: Array<{ type: string; text: string }>;
  }>;
}): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return false;
  }
}

/**
 * GET /api/slurm/jwt/alert
 * 
 * This endpoint checks the JWT token expiration and sends a Slack notification
 * if the token is expiring within the configured threshold.
 * 
 * Query parameters:
 * - force: If 'true', send notification regardless of expiry status
 * - threshold: Days until expiry to trigger alert (overrides env default)
 * 
 * Environment variables:
 * - SLURM_API_TOKEN: The JWT token to check
 * - SLACK_WEBHOOK_URL: Slack incoming webhook URL for notifications
 * - SLURM_TOKEN_EXPIRY_WARNING_DAYS: Days threshold for warnings (default: 30)
 * - CLUSTER_NAME: (optional) Name of the cluster for notification context
 * 
 * Example cron usage (daily at 9am):
 * 0 9 * * * curl -s "https://your-dashboard/api/slurm/jwt/alert"
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceNotify = searchParams.get('force') === 'true';
    // Use query param threshold, or env var, or default to 30 days
    const defaultThreshold = parseInt(env.SLURM_TOKEN_EXPIRY_WARNING_DAYS || '30', 10);
    const thresholdDays = parseInt(searchParams.get('threshold') || String(defaultThreshold), 10);

    const token = env.SLURM_API_TOKEN;
    const webhookUrl = env.SLACK_WEBHOOK_URL;
    const clusterName = env.CLUSTER_NAME || "Slurm HPC Dashboard";
    const description = env.SLURM_TOKEN_EXPIRY_DESCRIPTION;

    // Validate configuration
    if (!token) {
      return NextResponse.json({
        success: false,
        error: "No SLURM API token configured"
      }, { status: 400 });
    }

    if (!webhookUrl) {
      return NextResponse.json({
        success: false,
        error: "No Slack webhook URL configured (SLACK_WEBHOOK_URL)"
      }, { status: 400 });
    }

    // Decode the token
    const decoded = decodeJWT(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: "Invalid JWT token format"
      }, { status: 400 });
    }

    const { payload } = decoded;
    const now = Math.floor(Date.now() / 1000);

    if (!payload.exp) {
      return NextResponse.json({
        success: false,
        error: "JWT token has no expiration date"
      }, { status: 400 });
    }

    const expiresAt = new Date(payload.exp * 1000);
    const isExpired = payload.exp < now;
    const secondsUntilExpiry = payload.exp - now;
    const daysUntilExpiry = Math.floor(secondsUntilExpiry / 86400);
    const hoursUntilExpiry = Math.floor((secondsUntilExpiry % 86400) / 3600);

    // Determine if we should send a notification
    const shouldNotify = forceNotify || isExpired || daysUntilExpiry <= thresholdDays;

    if (!shouldNotify) {
      return NextResponse.json({
        success: true,
        notificationSent: false,
        message: `Token expires in ${daysUntilExpiry} days, above threshold of ${thresholdDays} days`,
        details: {
          daysUntilExpiry,
          expiresAt: expiresAt.toISOString(),
          thresholdDays
        }
      });
    }

    // Determine urgency level for message styling
    let urgencyText = "Warning";

    if (isExpired) {
      urgencyText = "EXPIRED";
    } else if (daysUntilExpiry <= 3) {
      urgencyText = "CRITICAL";
    } else if (daysUntilExpiry <= 7) {
      urgencyText = "Urgent";
    }

    // Build the Slack message
    const expiryTimeText = isExpired 
      ? `Expired on ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}`
      : daysUntilExpiry > 0
        ? `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} and ${hoursUntilExpiry} hour${hoursUntilExpiry !== 1 ? 's' : ''}`
        : `Expires in ${hoursUntilExpiry} hour${hoursUntilExpiry !== 1 ? 's' : ''}`;
    
    const username = payload.sun || env.SLURM_API_ACCOUNT || "Unknown";

    const blocks: Array<{
      type: string;
      text?: { type: string; text: string; emoji?: boolean };
      fields?: Array<{ type: string; text: string }>;
      elements?: Array<{ type: string; text: string }>;
    }> = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Slurm API Token - ${urgencyText}`,
          emoji: false
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Cluster:*\n${clusterName}`
          },
          {
            type: "mrkdwn",
            text: `*Status:*\n${isExpired ? 'Expired' : 'Expiring Soon'}`
          },
          {
            type: "mrkdwn",
            text: `*Username:*\n${username}`
          },
          {
            type: "mrkdwn",
            text: `*Time Remaining:*\n${expiryTimeText}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Expiration Date:*\n${expiresAt.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          })}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Generate a new token using `scontrol token lifespan=<days>` and update your dashboard configuration."
          }
        ]
      }
    ];

    if (description) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Description: ${description}`
          }
        ]
      });
    }

    const slackMessage = {
      text: `[${urgencyText}] Slurm API Token ${isExpired ? 'has expired' : 'expiring soon'} for ${clusterName}`,
      blocks
    };

    // Send the notification
    const notificationSent = await sendSlackNotification(webhookUrl, slackMessage);

    if (!notificationSent) {
      return NextResponse.json({
        success: false,
        error: "Failed to send Slack notification",
        details: {
          daysUntilExpiry,
          expiresAt: expiresAt.toISOString(),
          isExpired
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      notificationSent: true,
      message: `Notification sent successfully`,
      details: {
        daysUntilExpiry,
        expiresAt: expiresAt.toISOString(),
        isExpired,
        urgency: urgencyText
      }
    });
  } catch (error) {
    console.error("Error in JWT expiry alert:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
}
