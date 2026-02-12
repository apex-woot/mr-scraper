import type { ParseInput, Parser } from './types'

export interface JobDetailsResult {
  employmentType: string | null
  seniorityLevel: string | null
  jobFunction: string | null
  industries: string[]
}

const KEYS = {
  employmentType: 'employment type',
  seniorityLevel: 'seniority level',
  jobFunction: 'job function',
  industries: 'industries',
} as const

export class JobDetailsParser implements Parser<JobDetailsResult> {
  readonly sectionName = 'job-details'

  parse(input: ParseInput): JobDetailsResult | null {
    const lines = normalizeDetailLines(input.texts)
    if (lines.length === 0) return null

    const values = new Map<keyof typeof KEYS, string[]>()
    let currentKey: keyof typeof KEYS | null = null

    for (const line of lines) {
      const key = matchKey(line)
      if (key) {
        currentKey = key
        values.set(key, [])
        continue
      }

      if (!currentKey) continue
      values.get(currentKey)?.push(line)
    }

    const industriesRaw = values.get('industries') ?? []
    const industries = industriesRaw
      .flatMap((v) => v.split(/\s*,\s*/g))
      .map((v) => v.trim())
      .filter(Boolean)

    const employmentType = firstValue(values.get('employmentType'))
    const seniorityLevel = firstValue(values.get('seniorityLevel'))
    const jobFunction = firstValue(values.get('jobFunction'))

    if (!employmentType && !seniorityLevel && !jobFunction && industries.length === 0) return null

    return {
      employmentType,
      seniorityLevel,
      jobFunction,
      industries,
    }
  }

  validate(item: JobDetailsResult): boolean {
    return (
      !!item.employmentType ||
      !!item.seniorityLevel ||
      !!item.jobFunction ||
      (Array.isArray(item.industries) && item.industries.length > 0)
    )
  }
}

function normalizeDetailLines(lines: string[]): string[] {
  const out: string[] = []

  for (const raw of lines) {
    const trimmed = normalizeLinkedInText(raw)
    if (!trimmed) continue

    const lower = trimmed.toLowerCase()
    if (lower === 'job details') continue
    if (lower === 'show more' || lower === 'show less') continue

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

function matchKey(line: string): keyof typeof KEYS | null {
  const lower = line.toLowerCase().trim()
  if (lower === KEYS.employmentType) return 'employmentType'
  if (lower === KEYS.seniorityLevel) return 'seniorityLevel'
  if (lower === KEYS.jobFunction) return 'jobFunction'
  if (lower === KEYS.industries) return 'industries'
  return null
}

function firstValue(values?: string[]): string | null {
  const v = values?.map((s) => s.trim()).filter(Boolean)[0]
  return v ?? null
}
