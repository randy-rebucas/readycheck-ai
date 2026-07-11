FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@readycheck/worker

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/apps/worker/node_modules ./node_modules
COPY --from=build /app/node_modules ./root_node_modules
CMD ["node", "dist/main.js"]
