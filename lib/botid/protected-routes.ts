/** POST paths BotID challenges. Keep in sync with `checkBotId()` call sites. */
export const BOTID_PROTECTED_POST_PATHS = [
  "/api/composer-unlock",
  "/api/live-chat/session",
  "/api/live-chat/session/*/messages",
  "/api/live-chat/session/*/typing",
  "/api/live-chat/session/*/ai",
] as const

export const BOTID_PROTECTED_ROUTES = BOTID_PROTECTED_POST_PATHS.map((path) => ({
  path,
  method: "POST" as const,
}))
