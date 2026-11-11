/** One iconic surf break used as a Name the Break challenge. */
export interface SurfBreakChallenge {
  id: string
  name: string
  /** Short region label shown as an optional hint. */
  region: string
  country: string
  imageUrl: string
  imageCredit: string
  imageLicense: string
  imageSourceUrl: string
  /** One-liner revealed after the player answers. */
  fact: string
  /** Optional /boards?type= filter for the soft marketplace CTA. */
  boardType?: string
}

export interface NameTheBreakRound {
  challenge: SurfBreakChallenge
  /** Four answer labels including the correct name, already shuffled. */
  choices: string[]
}
