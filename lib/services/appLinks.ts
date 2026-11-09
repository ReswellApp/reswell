import {
  APP_LINK_AASA_COMPONENTS,
  APP_LINK_AASA_PATHS,
  APP_LINK_HOST,
} from "@reswell/api-contract"

export const IOS_APP_BUNDLE_ID = "app.reswell.reswell"
export const ANDROID_APP_PACKAGE_NAME = "app.reswell.mobile"
export { APP_LINK_HOST }

export type AppleAppSiteAssociation = {
  applinks: {
    apps: []
    details: Array<
      | {
          appIDs: string[]
          components: Array<{ "/": string; comment: string }>
        }
      | {
          appID: string
          paths: readonly string[]
        }
    >
  }
}

export type AndroidAssetLink = {
  relation: ["delegate_permission/common.handle_all_urls"]
  target: {
    namespace: "android_app"
    package_name: string
    sha256_cert_fingerprints: string[]
  }
}

type EnvMap = Record<string, string | undefined>

export function appleTeamIdFromEnv(env: EnvMap = process.env): string | null {
  const teamId = env.APPLE_TEAM_ID?.trim()
  return teamId || null
}

/** SHA-256 fingerprints, colon-separated uppercase hex. */
export function androidSha256FingerprintsFromEnv(env: EnvMap = process.env): string[] {
  const raw = env.ANDROID_APP_LINKS_SHA256_FINGERPRINTS?.trim() ?? ""
  if (!raw) return []
  const out: string[] = []
  for (const part of raw.split(/[\s,]+/)) {
    const normalized = normalizeSha256Fingerprint(part)
    if (normalized && !out.includes(normalized)) out.push(normalized)
  }
  return out
}

export function normalizeSha256Fingerprint(value: string): string | null {
  const hex = value.replace(/[^0-9a-f]/gi, "").toUpperCase()
  if (hex.length !== 64) return null
  return hex.match(/.{2}/g)?.join(":") ?? null
}

export function buildAppleAppSiteAssociation(input: {
  teamId: string
  bundleId?: string
}): AppleAppSiteAssociation {
  const appId = `${input.teamId.trim()}.${input.bundleId?.trim() || IOS_APP_BUNDLE_ID}`
  return {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [appId],
          components: APP_LINK_AASA_COMPONENTS.map((component) => ({ ...component })),
        },
        {
          appID: appId,
          paths: APP_LINK_AASA_PATHS,
        },
      ],
    },
  }
}

export function buildAndroidAssetLinks(input: {
  packageName?: string
  sha256CertFingerprints: string[]
}): AndroidAssetLink[] {
  const fingerprints = input.sha256CertFingerprints
    .map((value) => normalizeSha256Fingerprint(value))
    .filter((value): value is string => Boolean(value))
  if (fingerprints.length === 0) return []
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: input.packageName?.trim() || ANDROID_APP_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]
}

/** Apple rejects `application/json; charset=utf-8` on older AASA validators. */
export const WELL_KNOWN_JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=3600",
} as const

export const WELL_KNOWN_NOT_CONFIGURED_HEADERS = {
  "Cache-Control": "no-store",
} as const

export function appleAppSiteAssociationFromEnv(
  env: EnvMap = process.env,
): AppleAppSiteAssociation | null {
  const teamId = appleTeamIdFromEnv(env)
  if (!teamId) return null
  return buildAppleAppSiteAssociation({ teamId })
}

export function androidAssetLinksFromEnv(env: EnvMap = process.env): AndroidAssetLink[] | null {
  const links = buildAndroidAssetLinks({
    sha256CertFingerprints: androidSha256FingerprintsFromEnv(env),
  })
  return links.length > 0 ? links : null
}
