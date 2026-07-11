FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@readycheck/dashboard

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/dashboard/.next ./.next
COPY --from=build /app/apps/dashboard/public ./public
COPY --from=build /app/apps/dashboard/package.json ./package.json
COPY --from=build /app/apps/dashboard/node_modules ./node_modules
COPY --from=build /app/node_modules ./root_node_modules
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
