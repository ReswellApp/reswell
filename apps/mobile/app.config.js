const { loadRepoEnv } = require("./load-root-env")
const appJson = require("./app.json")

loadRepoEnv()

const GOOGLE_SIGN_IN = "@react-native-google-signin/google-signin"
const IOS_CLIENT_SUFFIX = ".apps.googleusercontent.com"

/** Reversed iOS OAuth client ID. Google requires this as a URL scheme. */
function googleIosUrlScheme(iosClientId) {
  const id = iosClientId.trim()
  if (!id.endsWith(IOS_CLIENT_SUFFIX)) return null
  const client = id.slice(0, -IOS_CLIENT_SUFFIX.length)
  if (!client || /[^A-Za-z0-9-]/.test(client)) return null
  return `com.googleusercontent.apps.${client}`
}

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? ""
const scheme = googleIosUrlScheme(iosClientId)
if (!scheme) {
  console.warn(
    iosClientId.trim()
      ? "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be an iOS OAuth client ID ending in .apps.googleusercontent.com."
      : "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is unset. iOS Google sign-in needs it at build time.",
  )
}
const plugins = (appJson.expo.plugins ?? []).filter((plugin) => {
  if (plugin === GOOGLE_SIGN_IN) return false
  return !(Array.isArray(plugin) && plugin[0] === GOOGLE_SIGN_IN)
})

if (scheme) {
  plugins.push([GOOGLE_SIGN_IN, { iosUrlScheme: scheme }])
}

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
  },
}
