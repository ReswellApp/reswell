/**
 * Invisible browser check. Fail closed on a bot classification; fail open if
 * BotID itself throws so a vendor outage does not lock messaging.
 */
export async function assertHumanRequest(): Promise<{ ok: true } | { ok: false }> {
  try {
    const { checkBotId } = await import("botid/server")
    const verification = await checkBotId()
    if (verification.isBot) return { ok: false }
    return { ok: true }
  } catch (error) {
    console.error("[botProtection] checkBotId failed", error)
    return { ok: true }
  }
}
