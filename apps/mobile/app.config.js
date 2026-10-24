const { loadRepoEnv } = require("./load-root-env")
const appJson = require("./app.json")

loadRepoEnv()

module.exports = {
  expo: {
    ...appJson.expo,
  },
}
