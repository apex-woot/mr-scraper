import type { ParseInput, Parser } from './types'

export class JobDescriptionParser implements Parser<string> {
  readonly sectionName = 'job-description'

  parse(input: ParseInput): string | null {
    const lines = normalizeDescriptionLines(input.texts)
    if (lines.length === 0) return null
    return lines.join('\n').trim() || null
  }

  validate(item: string): boolean {
    return item.trim().length > 0
  }
}

function normalizeDescriptionLines(lines: string[]): string[] {
  const out: string[] = []

  for (const raw of lines) {
    const trimmed = normalizeLinkedInText(raw)
    if (!trimmed) continue

    const lower = trimmed.toLowerCase()
    if (lower === 'about the job' || lower === 'job description') continue
    if (lower === 'show more' || lower === 'show less' || lower === 'see more' || lower === 'see less') continue

    if (out[out.length - 1] !== trimmed) out.push(trimmed)
  }

  return out
}

function normalizeLinkedInText(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/\u00c2/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
