import type { Locator } from 'playwright'

export interface ExtractedLink {
  url: string
  text: string
  isExternal: boolean
}

export interface ExtractedText {
  texts: string[]
  links: ExtractedLink[]
  subItems?: ExtractedText[]
  confidence: number
}

export interface TextExtractor {
  readonly name: string
  readonly priority: number
  canHandle(element: Locator): Promise<boolean>
  extract(element: Locator): Promise<ExtractedText | null>
}
