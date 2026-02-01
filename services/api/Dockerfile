FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
RUN corepack enable

# Copy only what runtime needs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/api/package.json ./services/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Install prod deps (workspace-aware)
RUN pnpm install --prod --frozen-lockfile

# Copy prebuilt output (must exist before docker build)
COPY services/api/dist ./services/api/dist
COPY packages/shared/dist ./packages/shared/dist

ENV PORT=3000
EXPOSE 3000
CMD ["node", "services/api/dist/index.js"]