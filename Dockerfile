FROM node:lts-alpine AS deps
WORKDIR /usr/src/app
COPY package.json package-lock.json* npm-shrinkwrap.json* ./
RUN npm ci --omit=dev

FROM node:lts-alpine AS builder
WORKDIR /usr/src/app
COPY package.json package-lock.json* npm-shrinkwrap.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:lts-alpine AS runner
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --chown=node:node --from=deps /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/.next ./.next
COPY --chown=node:node --from=builder /usr/src/app/public ./public
COPY --chown=node:node --from=builder /usr/src/app/package.json ./package.json
COPY --chown=node:node --from=builder /usr/src/app/next.config.ts ./next.config.ts
USER node
EXPOSE 3000
CMD ["npm", "start"]
