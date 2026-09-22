# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml .npmrc tsconfig.base.json turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @kev-ai/schema --filter @kev-ai/core --filter @kev-ai/backends --filter @kev-ai/server build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV KEV_HOST=0.0.0.0
ENV KEV_PORT=3000
ENV KEV_BACKEND=mock

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=build /app /app

EXPOSE 3000
WORKDIR /app/apps/server
CMD ["node", "dist/cli.js"]
