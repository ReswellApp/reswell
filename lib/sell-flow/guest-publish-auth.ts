import { toast } from "sonner"
import {
  markPendingPublish,
  type SellFlowListingKind,
} from "@/lib/sell-flow/session-keys"

type OpenSignIn = (
  redirect?: string | null,
  options?: { preferSignUp?: boolean; skipSessionProbe?: boolean },
) => void

/**
 * Guest hit Publish: persist the draft (including in-flight photos), then open
 * sign-up. Persist runs first so a fast Google OAuth redirect cannot beat IndexedDB.
 */
export async function beginGuestListingPublishAuth(args: {
  kind: SellFlowListingKind
  returnPath: string
  openSignIn: OpenSignIn
  persistDraft?: () => Promise<void>
}): Promise<void> {
  markPendingPublish(args.kind)
  if (args.persistDraft) {
    try {
      await args.persistDraft()
    } catch {
      /* form state still holds the listing until navigation */
    }
  }
  args.openSignIn(args.returnPath, {
    preferSignUp: true,
    skipSessionProbe: true,
  })
  toast.message("Listing saved on this device", {
    description: "Create a free account to publish — you’ll pick up right here.",
  })
}
