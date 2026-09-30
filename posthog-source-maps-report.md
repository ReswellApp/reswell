# PostHog Source Maps — Current Build Policy

## Current behavior

`withPostHogConfig` remains installed, but `sourcemaps.enabled` is explicitly
`false`. The Vercel project runs `npm run build` directly and has no reliable
detached post-build hook, so source-map processing cannot be moved off the
deployment's blocking path safely.

The runtime PostHog integrations are unchanged:

- Product analytics, identify, and session replay still use `posthog-js`.
- Browser exception capture remains enabled through `capture_exceptions` and
  the root error boundary.
- Server-side PostHog events still use `posthog-node`.
- The first-party `/ingest` rewrite remains enabled.

## Symbolication impact

Previously uploaded symbol sets continue to symbolicate errors from their
matching older releases. New deployments do not upload client or server source
maps to PostHog, so their minified browser stacks and compiled server stacks
are not unminified by PostHog. Vercel's own runtime log handling is unaffected.

## Build impact

Production logs showed the PostHog compiler hook scanning roughly 3,900 source
map pairs and uploading roughly 2,500 chunks for about 90 seconds before static
generation. Disabling the hook removes that blocking stage. Compile and static
generation time are otherwise unchanged.

## Rollback

Set `sourcemaps.enabled` back to `true` in `next.config.mjs` to restore the
blocking upload. Keep `POSTHOG_API_KEY` in Vercel's secret store; never commit
its value.
