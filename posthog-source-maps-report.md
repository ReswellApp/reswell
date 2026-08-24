# PostHog Source Map Upload — Setup Report

## Files changed

| File | Change |
|------|--------|
| `next.config.mjs` | Added `withPostHogConfig` wrapper; imports `@posthog/nextjs-config` |
| `package.json` / `package-lock.json` | Added `@posthog/nextjs-config` dependency |
| `.env.local` | Added `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`; `NEXT_PUBLIC_POSTHOG_HOST` confirmed present |

## How it works

`withPostHogConfig` wraps your Next.js build config and automatically:
- Generates source maps during `next build`
- Injects `//# chunkId=…` comments into output bundles
- Uploads source maps to PostHog
- Deletes the `.map` files from the build output so they are not served publicly

Source maps are only uploaded on **production builds** (`NODE_ENV=production`). The dev server does not upload.

## Build and upload command

```sh
npm run build   # next build — injects chunk IDs and uploads source maps
```

## Run command (production)

```sh
npm run start   # next start
```

## Environment variables written to `.env.local`

| Variable | Purpose |
|----------|---------|
| `POSTHOG_API_KEY` | Personal API key with error-tracking write access |
| `POSTHOG_PROJECT_ID` | PostHog project ID (568248) |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog ingestion host (already present) |

## CI / Vercel action required

This project deploys via **Vercel**. There is no Dockerfile or GitHub Actions workflow — the build runs directly on Vercel's build infrastructure.

**You must add the following environment variables to your Vercel project settings** before the next deploy so source maps upload on production builds:

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add these three variables (scope: **Production**, and optionally Preview):

| Variable | Value |
|----------|-------|
| `POSTHOG_API_KEY` | Your personal PostHog API key (the one you pasted in the wizard) |
| `POSTHOG_PROJECT_ID` | `568248` |

`NEXT_PUBLIC_POSTHOG_HOST` should already be present in Vercel — verify it's there.

> Never commit `POSTHOG_API_KEY` to version control. Keep it in Vercel's secret store only.

## How to verify the upload landed

After your next production build (locally or on Vercel), check the **Symbol sets** page:

https://us.posthog.com/project/568248/error_tracking/configuration

A new symbol set entry should appear within a few seconds of the build completing. Stack traces in [Error Tracking](https://us.posthog.com/project/568248/error_tracking) will resolve to real source file paths instead of minified bundle paths.
