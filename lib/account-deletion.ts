export const ACCOUNT_DELETE_PATH = "/account/delete"
export const ACCOUNT_DELETED_PATH = "/account/deleted"
export const ACCOUNT_DELETE_CONFIRMATION = "DELETE"

export type AccountDeletionBlockerCode = "admin" | "open_orders" | "wallet"

export type AccountDeletionBlocker = {
  code: AccountDeletionBlockerCode
  message: string
  href?: string
}
