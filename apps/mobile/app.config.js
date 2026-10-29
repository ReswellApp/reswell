const { loadRepoEnv } = require("./load-root-env")
const appJson = require("./app.json")

loadRepoEnv()

/** Public iOS OAuth client ID. Env can override; placeholders must not. */
const DEFAULT_GOOGLE_IOS_CLIENT_ID =
  "942414488993-7pcabkve6dcps7cm9vj6fmhj5rss9rer.apps.googleusercontent.com"

function googleIosUrlScheme(iosClientId) {
  const trimmed = iosClientId?.trim() ?? ""
  const match = trimmed.match(/^([^.]+(?:\.[^.]+)*)\.apps\.googleusercontent\.com$/)
  if (!match) return null
  return `com.googleusercontent.apps.${match[1]}`
}

const iosClientIdRaw = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? ""
const iosUrlScheme =
  googleIosUrlScheme(iosClientIdRaw) ?? googleIosUrlScheme(DEFAULT_GOOGLE_IOS_CLIENT_ID)

if (iosClientIdRaw && !googleIosUrlScheme(iosClientIdRaw)) {
  console.warn(
    `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not a real iOS OAuth client ID (${iosClientIdRaw}). Using the default Reswell iOS client ID for the Google URL scheme.`,
  )
}

const plugins = [...(appJson.expo.plugins ?? [])]
if (iosUrlScheme) {
  plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme }])
}

const appleTeamId = process.env.APPLE_TEAM_ID?.trim() || ""

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
    ios: {
      ...appJson.expo.ios,
      associatedDomains: ["applinks:www.reswell.app"],
      ...(appleTeamId ? { appleTeamId } : {}),
    },
  },
}
