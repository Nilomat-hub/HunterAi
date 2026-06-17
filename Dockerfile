# syntax=docker/dockerfile:1

# Base image ships a Linux Chromium + all system deps that match the
# installed Playwright version, so browser automation works the same in
# every environment (no Vercel serverless / Windows fallback guessing).
FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Placeholders so `next build` never reaches a real database or auth secret.
# Real values are injected at runtime via the environment.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV NEXTAUTH_SECRET="build-time-placeholder"
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
# Run as the image's non-root browser user so Chromium's sandbox works
# without --no-sandbox. pwuser needs to own the app dir for the Next cache.
RUN chown -R pwuser:pwuser /app
USER pwuser
EXPOSE 3000
# migrate deploy is idempotent and safe to run on every start.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
