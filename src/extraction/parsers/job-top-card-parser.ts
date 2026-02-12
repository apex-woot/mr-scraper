import type { ExtractedLink } from '../text-extractors'
import type { ParseInput, Parser } from './types'

export interface JobTopCardResult {
  title: string
  companyName: string | null
  companyUrl: string | null
  location: string | null
  workplaceType: string | null
  postedAt: string | null
  applicantCount: number | null
  jobId: string | null
}

export class JobTopCardParser implements Parser<JobTopCardResult> {
  readonly sectionName = 'job-top-card'

  parse(input: ParseInput): JobTopCardResult | null {
    const lines = normalizeTopCardLines(input.texts)
    if (lines.length === 0) return null

    const title = lines[0]
    if (!title) return null

    const companyFromLink = findCompanyLink(input.links)
    const companyName = companyFromLink?.text ?? findLikelyCompanyName(lines.slice(1))
    const companyUrl = companyFromLink?.url ?? null

    const jobId = extractJobIdFromLinks(input.links) ?? extractJobIdFromContext(input.context) ?? null

    const meta = extractMeta(lines)

    return {
      title,
      companyName,
      companyUrl,
      location: meta.location,
      workplaceType: meta.workplaceType,
      postedAt: meta.postedAt,
      applicantCount: meta.applicantCount,
      jobId,
    }
  }

  validate(item: JobTopCardResult): boolean {
    return item.title.trim().length > 0
  }
}

function normalizeTopCardLines(lines: string[]): string[] {
  const out: string[] = []

  for (const raw of lines) {
    const trimmed = normalizeLinkedInText(raw)
    if (!trimmed) continue
    if (isNoise(trimmed)) continue
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

function isNoise(line: string): boolean {
  const lower = line.toLowerCase()
  if (lower === 'save' || lower === 'share' || lower === 'more') return true
  if (lower.includes('report') || lower.includes('hide')) return true
  if (lower.includes('easy apply')) return true
  if (lower.includes('promoted')) return true
  if (lower.includes('see who you know')) return true
  return false
}

function findCompanyLink(links: ExtractedLink[]): ExtractedLink | null {
  for (const link of links) {
    if (!link.url) continue
    if (!link.text?.trim()) continue
    if (link.url.includes('/company/')) return link
  }
  return null
}

function findLikelyCompanyName(lines: string[]): string | null {
  for (const line of lines) {
    if (!line) continue
    if (line.length > 120) continue
    const lower = line.toLowerCase()
    if (lower.includes('applicant') || lower.includes('ago') || lower.includes('posted')) continue
    if (looksLikeLocation(line)) continue
    return line
  }
  return null
}

function looksLikeLocation(line: string): boolean {
  const lower = line.toLowerCase()
  if (lower.includes('remote') || lower.includes('hybrid') || lower.includes('on-site') || lower.includes('onsite')) {
    return true
  }
  if (line.includes(',')) return true
  if (lower.includes('united states') || lower.includes('united kingdom') || lower.includes('canada')) return true
  return false
}

function extractMeta(lines: string[]): {
  location: string | null
  workplaceType: string | null
  postedAt: string | null
  applicantCount: number | null
} {
  let location: string | null = null
  let workplaceType: string | null = null
  let postedAt: string | null = null
  let applicantCount: number | null = null

  for (const line of lines) {
    const { loc, workplace } = parseLocationAndWorkplace(line)
    if (!location && loc) location = loc
    if (!workplaceType && workplace) workplaceType = workplace

    if (postedAt === null) {
      const posted = parsePostedAt(line)
      if (posted) postedAt = posted
    }

    if (applicantCount === null) {
      const count = parseApplicantCount(line)
      if (count !== null) applicantCount = count
    }
  }

  return { location, workplaceType, postedAt, applicantCount }
}

function parseLocationAndWorkplace(line: string): { loc: string | null; workplace: string | null } {
  const match = line.match(/^(.*)\(([^)]+)\)\s*$/)
  if (!match) return { loc: looksLikeLocation(line) ? line : null, workplace: null }

  const loc = match[1]?.trim() || null
  const workplace = match[2]?.trim() || null
  if (!loc) return { loc: null, workplace }
  return { loc, workplace }
}

function parsePostedAt(line: string): string | null {
  const lower = line.toLowerCase()
  if (!lower.includes('ago') && !lower.includes('posted') && !lower.includes('reposted')) return null

  const parts = line.split(/\s*\u00b7\s*|\s*·\s*/g).map((p) => p.trim())
  const candidate = parts.find((p) => /ago\b/i.test(p) || /^posted\b/i.test(p) || /^reposted\b/i.test(p))
  return candidate ?? null
}

function parseApplicantCount(line: string): number | null {
  const m = line.match(/(\d[\d,]*)\s+applicants?/i)
  if (m?.[1]) return parseInt(m[1].replace(/,/g, ''), 10)

  const m2 = line.match(/be among the first\s+(\d[\d,]*)\s+applicants?/i)
  if (m2?.[1]) return parseInt(m2[1].replace(/,/g, ''), 10)

  return null
}

function extractJobIdFromLinks(links: ExtractedLink[]): string | null {
  for (const link of links) {
    const m = link.url.match(/\/jobs\/view\/(\d+)/)
    if (m?.[1]) return m[1]
  }
  return null
}

function extractJobIdFromContext(context: Record<string, string>): string | null {
  const url = context.url
  if (!url) return null
  const m = url.match(/\/jobs\/view\/(\d+)/)
  return m?.[1] ?? null
}
