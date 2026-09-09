export const MAX_OPEN_USER_SUPPORT_CASES = 5

export const OPEN_SUPPORT_CASE_LIMIT_REACHED =
  `You already have ${MAX_OPEN_USER_SUPPORT_CASES} open support requests. Continue one of those conversations — you can start a new one after one is closed.`

export function isOpenSupportCaseLimitReached(openCount: number): boolean {
  return openCount >= MAX_OPEN_USER_SUPPORT_CASES
}
