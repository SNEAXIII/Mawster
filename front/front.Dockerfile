# syntax=docker.io/docker/dockerfile:1

FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_CLIENT_HOST=92.112.192.100

RUN \
  if [ -f package-lock.json ]; then npm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
RUN apk add --no-cache bash

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_CLIENT_HOST=92.112.192.100
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs &&\
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chmod=755 --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chmod=755 --chown=nextjs:nodejs /app/.next/static ./.next/static


EXPOSE 3000
ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"

#Add utils script
COPY --chmod=555 ./run.sh ./wait-for-it.sh ./
RUN find . -type f -name "*.sh" -exec dos2unix {} \;

USER nextjs
