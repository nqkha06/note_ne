# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable \
    && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=stu-note-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS build

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN pnpm build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    BIND_HOST=0.0.0.0 \
    PORT=3001 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable \
    && corepack prepare pnpm@10.13.1 --activate \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs app

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=stu-note-pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

COPY --from=build --chown=app:nodejs /app/dist ./dist

USER app

EXPOSE 3001

CMD ["node", "dist/server.js"]
