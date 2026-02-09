import type { ParseInput, Parser } from './types'

export interface TopCardResult {
  name: string
  headline: string | null
  currentPosition: string | null
  origin: string | null
}

export class TopCardParser implements Parser<TopCardResult> {
  readonly sectionName = 'top-card'

  parse(input: ParseInput): TopCardResult | null {
    const cleanedLines = normalizeTopCardLines(input.texts)
    if (cleanedLines.length === 0) return null

    const nameLineIndex = cleanedLines.findIndex(isLikelyNameLine)
    const nameIndex = nameLineIndex >= 0 ? nameLineIndex : 0
    const name = cleanedLines[nameIndex] ?? 'Unknown'

    const remaining = cleanedLines.filter((_, index) => index !== nameIndex)
    const location = remaining.find(isLikelyLocationLine) ?? null
    const headline = remaining.find((line) => line !== location) ?? null

    return {
      name,
      headline: headline === name ? null : headline,
      currentPosition: headline === name ? null : headline,
      origin: location,
    }
  }

  validate(item: TopCardResult): boolean {
    return !!item.name && item.name !== 'Unknown'
  }
}

function normalizeTopCardLines(lines: string[]): string[] {
  const deduped: string[] = []

  for (const rawLine of lines) {
    const trimmed = rawLine
      .replace(/\s+/g, ' ')
      .replace(/\bContact info\b.*/i, '')
      .trim()

    if (!trimmed || isTopCardNoiseLine(trimmed)) continue
    if (deduped[deduped.length - 1] !== trimmed) deduped.push(trimmed)
  }

  return deduped
}

function isTopCardNoiseLine(line: string): boolean {
  const lower = line.toLowerCase()

  if (lower === 'contact info' || lower === 'more') return true
  if (lower === 'message' || lower === 'connect' || lower === 'follow') return true
  if (lower.includes('open to work')) return true
  if (lower.includes('connection') || lower.includes('follower')) return true

  return false
}

function isLikelyNameLine(line: string): boolean {
  if (line.length > 80 || /\d/.test(line)) return false

  const words = line.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 5) return false

  return words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word))
}

function isLikelyLocationLine(line: string): boolean {
  if (line.length < 3 || line.length > 120) return false
  if (/\d/.test(line)) return false

  const lower = line.toLowerCase()
  if (lower.includes(' at ') || lower.includes('currently')) return false
  if (lower.includes('open to work') || lower.includes('connection') || lower.includes('follower')) return false

  return line.includes(',') || /\b(area|region)\b/i.test(line)
}
