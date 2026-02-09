import type { ParseInput, Parser } from './types'

export class AboutParser implements Parser<string> {
  readonly sectionName = 'about'

  parse(input: ParseInput): string | null {
    const texts = normalizeAboutLines(input.texts)

    if (texts.length === 0) return null

    return texts.join('\n').trim() || null
  }

  validate(item: string): boolean {
    return item.length > 0
  }
}

function normalizeAboutLines(lines: string[]): string[] {
  const deduped: string[] = []

  for (const line of lines) {
    const normalized = line
      .replace(/\s+/g, ' ')
      .replace(/\.\.\.\s*see more$/i, '')
      .trim()
    if (!normalized || isAboutNoiseLine(normalized)) continue
    if (deduped[deduped.length - 1] !== normalized) deduped.push(normalized)
  }

  return deduped
}

function isAboutNoiseLine(line: string): boolean {
  const lower = line.toLowerCase()
  return lower === 'about' || lower === 'see more' || lower === 'see less' || lower === 'show more'
}
