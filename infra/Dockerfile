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

# Only pass non-secret, build-time app config into the client bundle.
ARG CLUSTER_NAME=Cluster
ARG CLUSTER_LOGO=
ARG NEXT_PUBLIC_BASE_URL=
ARG NEXT_PUBLIC_SUPPORT_URL=
ARG NEXT_PUBLIC_SLURM_API_VERSION=v0.0.40
ARG NEXT_PUBLIC_MAINT_NOTIFICATIONS_ENABLED=true
ARG NEXT_PUBLIC_ENABLE_MODULES_PLUGIN=true
ARG NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN=true
ARG NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN=false
ARG NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN=false
ARG NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN=false
ARG NEXT_PUBLIC_ENABLE_GPU_UTILIZATION=false
ARG NEXT_PUBLIC_ENABLE_INFLUXDB_PLUGIN=false
ARG NEXT_PUBLIC_HIERARCHY_LEVEL_1_LABEL=College
ARG NEXT_PUBLIC_HIERARCHY_LEVEL_2_LABEL=Department

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CLUSTER_NAME=${CLUSTER_NAME} \
    CLUSTER_LOGO=${CLUSTER_LOGO} \
    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} \
    NEXT_PUBLIC_SUPPORT_URL=${NEXT_PUBLIC_SUPPORT_URL} \
    NEXT_PUBLIC_SLURM_API_VERSION=${NEXT_PUBLIC_SLURM_API_VERSION} \
    NEXT_PUBLIC_MAINT_NOTIFICATIONS_ENABLED=${NEXT_PUBLIC_MAINT_NOTIFICATIONS_ENABLED} \
    NEXT_PUBLIC_ENABLE_MODULES_PLUGIN=${NEXT_PUBLIC_ENABLE_MODULES_PLUGIN} \
    NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN=${NEXT_PUBLIC_ENABLE_HISTORY_PLUGIN} \
    NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN=${NEXT_PUBLIC_ENABLE_JOB_METRICS_PLUGIN} \
    NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN=${NEXT_PUBLIC_ENABLE_OPENAI_PLUGIN} \
    NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN=${NEXT_PUBLIC_ENABLE_PROMETHEUS_PLUGIN} \
    NEXT_PUBLIC_ENABLE_GPU_UTILIZATION=${NEXT_PUBLIC_ENABLE_GPU_UTILIZATION} \
    NEXT_PUBLIC_ENABLE_INFLUXDB_PLUGIN=${NEXT_PUBLIC_ENABLE_INFLUXDB_PLUGIN} \
    NEXT_PUBLIC_HIERARCHY_LEVEL_1_LABEL=${NEXT_PUBLIC_HIERARCHY_LEVEL_1_LABEL} \
    NEXT_PUBLIC_HIERARCHY_LEVEL_2_LABEL=${NEXT_PUBLIC_HIERARCHY_LEVEL_2_LABEL}

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/infra ./infra
COPY --from=builder /app/data ./data

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD HOSTNAME="0.0.0.0" node server.js
