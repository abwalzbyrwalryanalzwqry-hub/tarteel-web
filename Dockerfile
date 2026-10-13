# ترتيل — صورة إنتاج متعددة المراحل (Node 22 LTS + pnpm)
#   build:   كل الاعتماديات + بناء الواجهة والخادم والسكربتات إلى dist/
#   runtime: اعتماديات الإنتاج فقط + dist + ترحيلات drizzle (لا vite ولا drizzle-kit ولا tsx ولا الشيفرة المصدرية)
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --prod --frozen-lockfile

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 STORAGE_DIR=/data/uploads
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# الترحيلات تعمل في خدمة migrate المستقلة (docker-compose.yml) قبل تشغيل التطبيق.
# تشغيل الصورة وحدها: docker run … node dist/migrate.js ثم docker run … (الأمر الافتراضي).
CMD ["node", "dist/index.js"]
