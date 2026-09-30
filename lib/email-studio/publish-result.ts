export type EmailStudioPublishResult =
  | { status: "success"; message: string }
  | { status: "warning"; message: string }
  | { status: "error"; message: string }

export function isEmailStudioPublishComplete(
  result: EmailStudioPublishResult | null,
): boolean {
  return result?.status === "success" || result?.status === "warning"
}
