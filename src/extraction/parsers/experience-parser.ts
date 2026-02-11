import type { Experience, Position } from '../../models/person'
import { isDateLine, isDescriptionLike, isLocationLike, parseDateRange, toPlainText } from '../../scrapers/person/utils'
import type { ExtractedLink } from '../text-extractors'
import {
  detectExperienceLayout,
  isLikelyCompanyName,
  parseGroupedPositions,
  sanitizeCompanyCandidate,
} from './experience-ir'
import type { ParseInput, Parser } from './types'

export class ExperienceParser implements Parser<Experience> {
  readonly sectionName = 'experience'

  parse(input: ParseInput): Experience | null {
    const texts = input.texts.map((t) => t.trim()).filter(Boolean)
    if (texts.length === 0) return null

    if (input.subItems && input.subItems.length > 0) {
      const company = sanitizeCompanyCandidate(texts[0])
      const positions = input.subItems
        .map((subItem) => parsePosition(subItem.texts, input.includeRaw === true))
        .filter((position): position is Position => !!position)

      if (positions.length === 0) return null

      return {
        company,
        companyUrl: input.links[0]?.url,
        ...(input.includeRaw ? { raw: toPlainText(input.texts) } : {}),
        positions,
      }
    }

    if (detectExperienceLayout(texts) === 'grouped') {
      const grouped = parseGroupedExperience(texts, input.links, input.includeRaw === true)
      if (grouped && this.validate(grouped)) return grouped
    }

    const parsed = parseSingleExperience(texts, input.links, input.includeRaw === true)
    if (!parsed) return null

    return {
      company: parsed.company,
      companyUrl: input.links[0]?.url,
      ...(input.includeRaw ? { raw: toPlainText(input.texts) } : {}),
      positions: [parsed.position],
    }
  }

  validate(item: Experience): boolean {
    if (!item.positions || item.positions.length === 0) return false

    const primary = item.positions[0]
    const hasPositionSignal = !!primary?.title || !!primary?.fromDate || !!primary?.location || !!primary?.description
    const hasInvalidCompany = !!item.company && !isLikelyCompanyName(item.company)
    if (hasInvalidCompany) return false

    return !!item.company || hasPositionSignal
  }
}

function parseGroupedExperience(texts: string[], links: ExtractedLink[], includeRaw: boolean): Experience | null {
  const company = sanitizeCompanyCandidate(texts[0])
  if (!company) return null

  const positions = parseGroupedPositions(texts, includeRaw)
  if (positions.length === 0) return null

  return {
    company,
    companyUrl: links[0]?.url,
    ...(includeRaw ? { raw: toPlainText(texts) } : {}),
    positions,
  }
}

function parseSingleExperience(
  texts: string[],
  links: ExtractedLink[],
  includeRaw: boolean,
): { company?: string; position: Position } | null {
  const title = texts[0]
  if (!title) return null

  const second = texts[1] ?? ''
  let company = sanitizeCompanyCandidate(second)
  let employmentType: string | undefined

  if (second.includes(' · ') && !isDateLine(second)) {
    const parts = second.split(' · ').map((part) => part.trim())
    company = sanitizeCompanyCandidate(parts[0])
    employmentType = parts[1] || undefined
  }

  const meta = extractMeta(texts.slice(2))

  const position: Position = {
    title,
    employmentType,
    fromDate: meta.fromDate,
    toDate: meta.toDate,
    duration: meta.duration,
    location: meta.location,
    description: meta.description,
    ...(includeRaw ? { raw: toPlainText(texts) } : {}),
  }

  return {
    company: company || sanitizeCompanyCandidate(links[0]?.text) || undefined,
    position,
  }
}

function parsePosition(texts: string[], includeRaw: boolean): Position | null {
  const lines = texts.map((t) => t.trim()).filter(Boolean)
  if (lines.length === 0) return null

  const title = lines[0]
  let employmentType: string | undefined

  if (lines[1] && !isDateLine(lines[1]) && !isLocationLike(lines[1])) employmentType = lines[1]

  const metaStart = employmentType ? 2 : 1
  const meta = extractMeta(lines.slice(metaStart))

  return {
    title,
    employmentType,
    fromDate: meta.fromDate,
    toDate: meta.toDate,
    duration: meta.duration,
    location: meta.location,
    description: meta.description,
    ...(includeRaw ? { raw: toPlainText(lines) } : {}),
  }
}

function extractMeta(lines: string[]): {
  fromDate?: string
  toDate?: string
  duration?: string
  location?: string
  description?: string
} {
  let fromDate: string | undefined
  let toDate: string | undefined
  let duration: string | undefined
  let location: string | undefined
  let description: string | undefined

  for (const line of lines) {
    if (!fromDate && isDateLine(line)) {
      const parsed = parseDateRange(line, { includeDuration: true })
      fromDate = parsed.fromDate ?? undefined
      toDate = parsed.toDate ?? undefined
      duration = parsed.duration ?? undefined
      continue
    }

    if (!location && isLocationLike(line)) {
      location = line
      continue
    }

    if (!description && isDescriptionLike(line)) description = line
  }

  return {
    fromDate,
    toDate,
    duration,
    location,
    description,
  }
}
