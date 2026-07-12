"use client"

type MetaParamBuilderClient = {
  processAndCollectAllParams: (url?: string | null) => Promise<unknown>
  getFbc: () => string
  getFbp: () => string
}

export type MetaClientBrowserSignals = {
  fbc: string | null
  fbp: string | null
}

let paramBuilder: MetaParamBuilderClient | null = null
let paramBuilderLoad: Promise<MetaParamBuilderClient> | null = null

async function loadParamBuilder(): Promise<MetaParamBuilderClient> {
  if (paramBuilder) return paramBuilder
  if (!paramBuilderLoad) {
    paramBuilderLoad = import("meta-capi-param-builder-clientjs").then((mod) => {
      const candidate = mod as MetaParamBuilderClient & {
        clientParamBuilder?: MetaParamBuilderClient
      }
      const resolved = candidate.clientParamBuilder ?? candidate
      paramBuilder = resolved
      return resolved
    })
  }
  return paramBuilderLoad
}

/** Ensures Meta `_fbc` / `_fbp` cookies are current for the given page URL. */
export async function primeMetaBrowserSignals(url?: string | null): Promise<void> {
  if (typeof window === "undefined") return
  const pb = await loadParamBuilder()
  await pb.processAndCollectAllParams(url ?? window.location.href)
}

/** Returns validated `_fbc` / `_fbp` for Conversions API server events. */
export async function collectMetaClientBrowserSignals(): Promise<MetaClientBrowserSignals> {
  if (typeof window === "undefined") return { fbc: null, fbp: null }

  const pb = await loadParamBuilder()
  await pb.processAndCollectAllParams(window.location.href)

  const fbc = pb.getFbc()?.trim() || null
  const fbp = pb.getFbp()?.trim() || null
  return { fbc, fbp }
}
