const { loadRepoEnv } = require("./load-root-env")
const appJson = require("./app.json")

loadRepoEnv()

function googleIosUrlScheme(iosClientId) {
  const trimmed = iosClientId?.trim() ?? ""
  const match = trimmed.match(/^([^.]+(?:\.[^.]+)*)\.apps\.googleusercontent\.com$/)
  if (!match) return null
  return `com.googleusercontent.apps.${match[1]}`
}

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? ""
const iosUrlScheme = googleIosUrlScheme(iosClientId)

if (iosClientId && !iosUrlScheme) {
  console.warn(
    "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be an iOS OAuth client ID ending in .apps.googleusercontent.com.",
  )
}

const plugins = [...(appJson.expo.plugins ?? [])]
if (iosUrlScheme) {
  plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme }])
}

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
  },
}
