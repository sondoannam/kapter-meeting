FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY nest-cli.json tsconfig.json tsconfig.build.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN pnpm prisma generate
RUN pnpm build

FROM base AS prod-deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

RUN mkdir -p /app/logs && chown -R nestjs:nodejs /app/logs

USER nestjs

EXPOSE 3001

CMD ["node", "dist/src/main.js"]