export type ArticleBlock =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }

export type FieldNoteArticle = {
  slug: string
  title: string
  deck: string
  excerpt: string
  author: string
  publishedAt: string
  readMinutes: number
  tag: string
  blocks: ArticleBlock[]
}

const ARTICLES: FieldNoteArticle[] = [
  {
    slug: "reading-a-used-board-listing",
    title: "How to read a used board listing like you’re in the shop",
    deck: "Photos and copy tell you more than the price tag if you know what to look for.",
    excerpt:
      "A practical pass over rocker shots, fin boxes, repairs, and the questions worth asking before you commit.",
    author: "Reswell",
    publishedAt: "2025-02-12",
    readMinutes: 6,
    tag: "Gear",
    blocks: [
      {
        kind: "p",
        text: "Most disappointment in secondhand boards comes from expecting a spec sheet to do the job of a conversation. Listings are compressed stories: someone is handing you clues about where the board lived, how hard it was ridden, and whether the seller actually looked at it lately.",
      },
      {
        kind: "h2",
        text: "Start with the silhouette",
      },
      {
        kind: "p",
        text: "Rocker and outline do more for how a board feels than length alone. In side profile, look for a continuous curve versus flat spots or kinks. From the tail, rail line and tail width hint at pivot versus hold. If the deck is heavily compressed or the stringer wanders, ask whether there are repairs out of frame.",
      },
      {
        kind: "h2",
        text: "Pressure dents and glass",
      },
      {
        kind: "p",
        text: "Even dents under the chest usually mean honest use. Sharp depressions at the knees or localized discoloration can point to repeated stress or water that never fully dried. Yellowing is not automatically bad; uneven yellowing or soft spots around boxes often is.",
      },
      {
        kind: "h2",
        text: "Fin boxes and plugs",
      },
      {
        kind: "p",
        text: "Cracks radiating from boxes are worth a second look. Future and long boxes are repairable when caught early; stripped screws or wobble in plugs are not a small detail. If the listing does not show the bottom around the cluster, it is reasonable to ask for one more photo before you drive an hour.",
      },
      {
        kind: "h2",
        text: "Questions that save time",
      },
      {
        kind: "p",
        text: "When it was last waxed and surfed, whether any repairs were professional or backyard, and how it compares to another board the seller knows—all of that turns a vague “good condition” into something you can trust. The best listings invite those questions; the best buyers ask them without apology.",
      },
    ],
  },
  {
    slug: "one-board-quiver-myth",
    title: "The one-board quiver is a myth—and that is fine",
    deck: "Why most of us rotate shapes by season, break, and mood.",
    excerpt:
      "Honest talk about overlap, regret buys, and the boards you actually reach for when the forecast shifts.",
    author: "Reswell",
    publishedAt: "2025-01-28",
    readMinutes: 5,
    tag: "Culture",
    blocks: [
      {
        kind: "p",
        text: "Marketing loves the image of a single perfect stick. Reality is messier: summer mush, winter swell, travel, injury, and plain boredom all nudge you toward different outlines and volumes. Owning more than one board is not a failure of discipline; it is matching tools to conditions.",
      },
      {
        kind: "h2",
        text: "Overlap is not waste",
      },
      {
        kind: "p",
        text: "Two boards that feel different in two-foot surf can both work in head-high waves with different tradeoffs. Overlap gives you choice on marginal days—the ones where you might otherwise stay home because your “main” board feels wrong.",
      },
      {
        kind: "h2",
        text: "The regret buy",
      },
      {
        kind: "p",
        text: "Almost everyone buys a board that looked right online and felt wrong underfoot. Reselling or trading is part of the learning curve. The marketplace exists so those experiments circulate instead of collecting dust in a garage.",
      },
      {
        kind: "h2",
        text: "What to optimize for",
      },
      {
        kind: "p",
        text: "If you can only stretch to two boards, think in terms of volume and rocker spread: something forgiving for weak waves, something with more hold when it gets proper. Everything else is refinement, not survival.",
      },
    ],
  },
  {
    slug: "local-shops-and-the-used-rack",
    title: "Local shops and the used rack",
    deck: "How brick-and-mortar and peer-to-peer selling keep the same ecosystem alive.",
    excerpt:
      "Shapers, retailers, and private sellers all move boards through the community—often the same board more than once.",
    author: "Reswell",
    publishedAt: "2024-12-04",
    readMinutes: 4,
    tag: "Community",
    blocks: [
      {
        kind: "p",
        text: "Consignment racks and online listings are not opposites. They are two doors into the same room: surfers trying boards, passing them on, and funding the next shape or trip. Shops add tuning, ding repair, and local knowledge; peer listings add range and oddball finds.",
      },
      {
        kind: "h2",
        text: "What shops still do best",
      },
      {
        kind: "p",
        text: "Fitting volume to your weight and fitness, spotting a bad repair, and steering you away from a trendy outline that does not match your break—these are conversations. A good shop earns its margin on that judgment as much as on new glass.",
      },
      {
        kind: "h2",
        text: "What the marketplace adds",
      },
      {
        kind: "p",
        text: "Breadth. Someone three states over might have the exact mid-length you have been sketching. Clear photos, honest descriptions, and patient messaging rebuild some of the trust you would get across a shop counter.",
      },
      {
        kind: "h2",
        text: "Same board, many chapters",
      },
      {
        kind: "p",
        text: "The board you buy used might have been someone’s custom, then a shop trade-in, then a listing here. Each handoff is a chapter. The goal is not to freeze the object in mint condition forever—it is to keep it in the water.",
      },
    ],
  },
  {
    slug: "traveling-with-a-board",
    title: "Traveling with a board without losing your mind",
    deck: "Bags, padding, and the small habits that prevent big cracks.",
    excerpt:
      "A short checklist for day trips and flights so your stick arrives rideable.",
    author: "Reswell",
    publishedAt: "2024-11-18",
    readMinutes: 5,
    tag: "Travel",
    blocks: [
      {
        kind: "p",
        text: "Most travel damage happens at the nose and tail—where leverage concentrates—and along rails where bags shift against roof racks. A little paranoia at packing time saves a week of staring at a crease you cannot unsee.",
      },
      {
        kind: "h2",
        text: "Day trips and roof racks",
      },
      {
        kind: "p",
        text: "Nose and tail blocks inside the bag, board deck-down if your rack pads favor that, and straps that do not twist the board against hard metal. Stop once on a long drive to check tension; heat softens wax and shifts loads.",
      },
      {
        kind: "h2",
        text: "Flights",
      },
      {
        kind: "p",
        text: "Assume baggage handlers will stack weight on your bag. Pipe insulation split along the rails, pool noodles over the nose, and a note that says “fragile” will not save you—but structure inside the bag will. Photograph the packed board in case you need to file a claim.",
      },
      {
        kind: "h2",
        text: "At your destination",
      },
      {
        kind: "p",
        text: "Let the board acclimate before surfing if it sat in a hot car or cold hold. Quick ding checks after every session on sharp reefs or rocky entries keep small cracks from growing. The trip is for waves; a ten-minute inspection is part of the ritual.",
      },
    ],
  },
]

export function getFieldNotesSorted(): FieldNoteArticle[] {
  return [...ARTICLES].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
}

export function getFieldNoteBySlug(slug: string): FieldNoteArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug)
}

export function getAllFieldNoteSlugs(): string[] {
  return ARTICLES.map((a) => a.slug)
}
