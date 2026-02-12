export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { env } from "process";

interface JWTPayload {
  exp?: number;
  iat?: number;
  sun?: string;  // Slurm user name
  [key: string]: unknown;
}

/**
 * Decode a JWT token without verification (for reading metadata only)
 * JWTs are structured as header.payload.signature, all base64url encoded
 */
function decodeJWT(token: string): { header: Record<string, unknown>; payload: JWTPayload } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode base64url (replace - and _ with + and /, then base64 decode)
    const base64UrlDecode = (str: string): string => {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      return Buffer.from(padded, 'base64').toString('utf8');
    };

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    return { header, payload };
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
}

export async function GET() {
  try {
    const token = env.SLURM_API_TOKEN;
    const username = env.SLURM_API_ACCOUNT;
    const description = env.SLURM_TOKEN_EXPIRY_DESCRIPTION;
    const slackConfigured = Boolean(env.SLACK_WEBHOOK_URL);

    if (!token) {
      return NextResponse.json({
        error: "No SLURM API token configured",
        configured: false
      }, { status: 200 });
    }

    const decoded = decodeJWT(token);

    if (!decoded) {
      return NextResponse.json({
        error: "Invalid JWT token format",
        configured: true,
        valid: false
      }, { status: 200 });
    }

    const { payload } = decoded;
    const now = Math.floor(Date.now() / 1000);

    // Calculate expiration details
    const expiresAt = payload.exp ? new Date(payload.exp * 1000).toISOString() : null;
    const createdAt = payload.iat ? new Date(payload.iat * 1000).toISOString() : null;
    const isExpired = payload.exp ? payload.exp < now : false;
    const expiresInSeconds = payload.exp ? payload.exp - now : null;
    const daysUntilExpiry = expiresInSeconds ? Math.floor(expiresInSeconds / 86400) : null;

    // Determine token status with expiry warning levels
    // Warning threshold from env (default 30 days), critical at 20% of that
    const warningThreshold = parseInt(env.SLURM_TOKEN_EXPIRY_WARNING_DAYS || '30', 10);
    const criticalThreshold = Math.max(3, Math.floor(warningThreshold * 0.2)); // 20% of warning, minimum 3 days
    
    let status: 'valid' | 'warning' | 'critical' | 'expired' = 'valid';
    if (isExpired) {
      status = 'expired';
    } else if (daysUntilExpiry !== null) {
      if (daysUntilExpiry <= criticalThreshold) {
        status = 'critical';
      } else if (daysUntilExpiry <= warningThreshold) {
        status = 'warning';
      }
    }

    return NextResponse.json({
      configured: true,
      valid: true,
      username: payload.sun || username || "Unknown",
      description: description || null,
      slackConfigured,
      createdAt,
      expiresAt,
      isExpired,
      expiresInSeconds,
      daysUntilExpiry,
      status,
      // Include any additional claims that might be useful
      algorithm: decoded.header.alg || "Unknown"
    });
  } catch (error) {
    console.error("Error processing JWT info:", error);
    return NextResponse.json({
      error: "Failed to process JWT information",
      configured: false
    }, { status: 500 });
  }
}
