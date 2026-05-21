import { accountsHelpArticles } from "@/lib/help-center/articles/accounts"
import { buyingHelpArticles } from "@/lib/help-center/articles/buying"
import { sellingHelpArticles } from "@/lib/help-center/articles/selling"
import type { HelpArticle } from "@/lib/help-center/types"

export const helpArticles: HelpArticle[] = [
  ...buyingHelpArticles,
  ...sellingHelpArticles,
  ...accountsHelpArticles,
]
