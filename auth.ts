import { createHmac, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, formCsrfMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";

const AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3020";
const AUTH_SECRET = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "";
const ADMIN_USER_ID = "admin";

function constantTimeEquals(actual: string, expected: string) {
  if (!AUTH_SECRET) {
    return false;
  }

  const actualDigest = createHmac("sha256", AUTH_SECRET)
    .update(actual)
    .digest();
  const expectedDigest = createHmac("sha256", AUTH_SECRET)
    .update(expected)
    .digest();

  return timingSafeEqual(actualDigest, expectedDigest);
}

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password || !AUTH_SECRET) {
    return null;
  }

  return { username, password };
}

const adminSignInBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

function adminCredentials() {
  return {
    id: "admin-credentials",
    endpoints: {
      signInAdmin: createAuthEndpoint(
        "/admin/sign-in",
        {
          method: "POST",
          use: [formCsrfMiddleware],
          body: adminSignInBodySchema,
        },
        async (ctx) => {
          const credentials = getAdminCredentials();

          if (!credentials) {
            ctx.context.logger.error("Admin credentials or auth secret are not configured.");
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Authentication is not configured.",
            });
          }

          const usernameMatches = constantTimeEquals(
            ctx.body.username,
            credentials.username
          );
          const passwordMatches = constantTimeEquals(
            ctx.body.password,
            credentials.password
          );

          if (!usernameMatches || !passwordMatches) {
            throw new APIError("UNAUTHORIZED", {
              message: "Invalid credentials.",
            });
          }

          const email = `${credentials.username}@admin.local`;
          const existingUser = await ctx.context.internalAdapter.findUserById(
            ADMIN_USER_ID
          );
          const user =
            existingUser ??
            (await ctx.context.internalAdapter.createUser({
              id: ADMIN_USER_ID,
              email,
              emailVerified: true,
              name: "Admin",
            }));

          const session = await ctx.context.internalAdapter.createSession(
            user.id,
            ctx.body.rememberMe === false
          );

          await setSessionCookie(
            ctx,
            { session, user },
            ctx.body.rememberMe === false
          );

          return ctx.json({
            token: session.token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
          });
        }
      ),
    },
  } satisfies BetterAuthPlugin;
}

export const auth = betterAuth({
  appName: "Slurm Node Dashboard",
  baseURL: AUTH_URL,
  secret: AUTH_SECRET,
  trustedOrigins: [AUTH_URL],
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 30,
    cookieCache: {
      enabled: true,
      strategy: "jwe",
      maxAge: 60 * 60 * 8,
      refreshCache: true,
    },
  },
  advanced: {
    cookiePrefix: "slurm-dashboard",
  },
  plugins: [adminCredentials(), nextCookies()],
});

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
