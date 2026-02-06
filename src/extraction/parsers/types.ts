import type { RawSection } from '../page-extractors'
import type { ExtractedLink } from '../text-extractors'

export interface ParseInput {
  texts: string[]
  links: ExtractedLink[]
  subItems?: ParseInput[]
  context: Record<string, string>
}

export interface Parser<T> {
  readonly sectionName: string
  parse(input: ParseInput): T | null
  validate(item: T): boolean
}

export interface RawParser<T> extends Parser<T> {
  parseRaw(sections: RawSection[]): T[]
}
