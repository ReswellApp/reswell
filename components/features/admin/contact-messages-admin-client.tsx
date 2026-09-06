/**
 * Legacy entry — Case inbox lives in case-inbox-admin-client.
 * Re-exports keep existing imports working.
 */
export {
  CaseInboxAdminClient,
  CaseInboxAdminClient as ContactMessagesAdminClient,
  ADMIN_SUPPORT_INBOX_ORDER_SUPPORT_HREF,
} from "@/components/features/admin/case-inbox-admin-client"
