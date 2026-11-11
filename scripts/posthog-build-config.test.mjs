import assert from 'node:assert/strict'
import test from 'node:test'

test('PostHog source maps stay outside the Next production build', async () => {
  const originalApiKey = process.env.POSTHOG_API_KEY
  const originalProjectId = process.env.POSTHOG_PROJECT_ID
  const originalHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

  process.env.POSTHOG_API_KEY = 'test-personal-key'
  process.env.POSTHOG_PROJECT_ID = 'test-project'
  process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com'

  try {
    const { default: config } = await import(`../next.config.mjs?test=${Date.now()}`)
    const resolved = typeof config === 'function'
      ? await config('phase-production-build', { defaultConfig: {} })
      : config

    assert.notEqual(resolved.productionBrowserSourceMaps, true)
    assert.equal(resolved.compiler?.runAfterProductionCompile, undefined)

    const rewrites = await resolved.rewrites()
    assert.ok(
      rewrites.afterFiles.some(({ source }) => source === '/ingest/:path*'),
      'PostHog runtime ingestion rewrite must remain enabled',
    )
  } finally {
    restoreEnv('POSTHOG_API_KEY', originalApiKey)
    restoreEnv('POSTHOG_PROJECT_ID', originalProjectId)
    restoreEnv('NEXT_PUBLIC_POSTHOG_HOST', originalHost)
  }
})

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
