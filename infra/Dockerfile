FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# data/ is where Rewind reads snapshot files from the pre-3.0 cron script. With
# a database the dashboard saves snapshots itself and data/ stays empty.
RUN mkdir -p data

# Pick one of the bundled favicons, e.g. CLUSTER_FAVICON=sol uses
# public/favicon.ico.sol. Empty keeps app/favicon.ico.
ARG CLUSTER_FAVICON=
RUN if [ -n "$CLUSTER_FAVICON" ]; then cp "public/favicon.ico.$CLUSTER_FAVICON" app/favicon.ico; fi

# Only the URL path is fixed at build time; Next.js needs it then.
ARG NEXT_PUBLIC_BASE_PATH=

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Everything else is read when the container runs: set it with -e/--env-file
# or in your Kubernetes manifest. These build args only exist so pre-3.0 build
# commands keep working; each becomes the container's default for that
# variable. Leave them empty so features turn on from what's configured.
ARG CLUSTER_NAME=
ARG CLUSTER_LOGO=
ARG NEXT_PUBLIC_BASE_URL=
ARG NEXT_PUBLIC_SUPPORT_URL=
ARG NEXT_PUBLIC_ENABLE_MODULES_PLUGIN=
ARG NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN=
ARG NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN=
ARG NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN=
ARG NEXT_PUBLIC_ENABLE_GPU_UTILIZATION=
ARG NEXT_PUBLIC_HIERARCHY_LEVEL_1_LABEL=
ARG NEXT_PUBLIC_HIERARCHY_LEVEL_2_LABEL=
ENV CLUSTER_NAME=${CLUSTER_NAME} \
    CLUSTER_LOGO=${CLUSTER_LOGO} \
    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} \
    NEXT_PUBLIC_SUPPORT_URL=${NEXT_PUBLIC_SUPPORT_URL} \
    NEXT_PUBLIC_ENABLE_MODULES_PLUGIN=${NEXT_PUBLIC_ENABLE_MODULES_PLUGIN} \
    NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN=${NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN} \
    NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN=${NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN} \
    NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN=${NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN} \
    NEXT_PUBLIC_ENABLE_GPU_UTILIZATION=${NEXT_PUBLIC_ENABLE_GPU_UTILIZATION} \
    NEXT_PUBLIC_HIERARCHY_LEVEL_1_LABEL=${NEXT_PUBLIC_HIERARCHY_LEVEL_1_LABEL} \
    NEXT_PUBLIC_HIERARCHY_LEVEL_2_LABEL=${NEXT_PUBLIC_HIERARCHY_LEVEL_2_LABEL}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/infra ./infra
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Numeric so Kubernetes runAsNonRoot can verify it (nextjs:nodejs)
USER 1001:1001

EXPOSE 3000

ENV PORT 3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD HOSTNAME="0.0.0.0" node server.js
