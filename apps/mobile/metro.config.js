const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

const projectRoot = __dirname
const contractEntry = path.resolve(projectRoot, "../../packages/api-contract/src/index.ts")

const config = getDefaultConfig(projectRoot)

config.resolver.assetExts = [...config.resolver.assetExts, "woff", "woff2"]
config.watchFolders = [path.resolve(projectRoot, "../../packages/api-contract")]
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")]
config.resolver.disableHierarchicalLookup = true

const upstreamResolve = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@reswell/api-contract") {
    return { filePath: contractEntry, type: "sourceFile" }
  }
  if (upstreamResolve) {
    return upstreamResolve(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
