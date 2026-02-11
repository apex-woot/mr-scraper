import type { Position } from '../../models/person'
import { isDateLine, isDescriptionLike, isLocationLike, parseDateRange, toPlainText } from '../../scrapers/person/utils'

export type ExperienceLayout = 'single' | 'grouped'

interface GroupedSegment {
  title: string
  employmentType?: string
  dateLine: string
  trailingLines: string[]
}

export function detectExperienceLayout(lines: string[]): ExperienceLayout {
  const normalized = normalize(lines)
  const second = normalized[1] ?? ''

  if (isDurationOnly(second)) return 'grouped'

  let dateLines = 0
  for (const line of normalized) {
    if (isDateLine(line)) dateLines++
    if (dateLines >= 2) return 'grouped'
  }

  return 'single'
}

export function parseGroupedPositions(lines: string[], includeRaw: boolean): Position[] {
  const normalized = normalize(lines)
  const body = stripGroupHeaderNoise(normalized.slice(1))
  const segments = toGroupedSegments(body)

  return segments
    .map((segment) => {
      const parsedDate = parseDateRange(segment.dateLine, { includeDuration: true })

      let location: string | undefined
      let description: string | undefined
      for (const line of segment.trailingLines) {
        if (!location && (isWorkplaceMode(line) || isDefiniteLocationLine(line) || isLocationLike(line))) {
          location = line
          continue
        }

        if (!description && isDescriptionLike(line)) description = line
      }

      const plainLines = [segment.title]
      if (segment.employmentType) plainLines.push(segment.employmentType)
      plainLines.push(segment.dateLine)
      plainLines.push(...segment.trailingLines)

      return {
        title: segment.title,
        employmentType: segment.employmentType,
        fromDate: parsedDate.fromDate ?? undefined,
        toDate: parsedDate.toDate ?? undefined,
        duration: parsedDate.duration ?? undefined,
        location,
        description,
        ...(includeRaw ? { raw: toPlainText(plainLines) } : {}),
      } satisfies Position
    })
    .filter((position) => !!position.title)
}

export function sanitizeCompanyCandidate(value?: string): string | undefined {
  if (!value) return undefined
  return isLikelyCompanyName(value) ? value : undefined
}

export function isLikelyCompanyName(value?: string): boolean {
  if (!value) return false

  const line = value.trim()
  if (!line) return false
  if (isDateLine(line)) return false
  if (isDurationOnly(line)) return false
  if (isEmploymentType(line)) return false
  if (isWorkplaceMode(line)) return false

  return true
}

function normalize(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter(Boolean)
}

function stripGroupHeaderNoise(lines: string[]): string[] {
  const filtered = [...lines]
  while (filtered.length > 0) {
    const first = filtered[0]
    if (!first) {
      filtered.shift()
      continue
    }

    if (isDurationOnly(first) || isEmploymentType(first) || isDateLine(first)) {
      filtered.shift()
      continue
    }

    break
  }

  return filtered
}

function toGroupedSegments(lines: string[]): GroupedSegment[] {
  const segments: GroupedSegment[] = []
  let index = 0

  while (index < lines.length) {
    const titleIndex = findNextTitleIndex(lines, index)
    if (titleIndex < 0) break

    const title = lines[titleIndex]
    if (!title) {
      index = titleIndex + 1
      continue
    }

    const employmentCandidate = lines[titleIndex + 1]
    const hasEmployment = !!employmentCandidate && isEmploymentType(employmentCandidate)
    const dateIndex = findDateIndex(lines, titleIndex + (hasEmployment ? 2 : 1))

    if (dateIndex < 0) {
      index = titleIndex + 1
      continue
    }

    const dateLine = lines[dateIndex]
    if (!dateLine) {
      index = dateIndex + 1
      continue
    }

    const nextStart = findNextSegmentStart(lines, dateIndex + 1)
    const trailingLines = lines.slice(dateIndex + 1, nextStart)

    segments.push({
      title,
      employmentType: hasEmployment ? employmentCandidate : undefined,
      dateLine,
      trailingLines,
    })

    index = nextStart
  }

  return segments
}

function findNextTitleIndex(lines: string[], fromIndex: number): number {
  for (let i = fromIndex; i < lines.length; i++) {
    const line = lines[i]
    if (line && isDefiniteLocationLine(line)) continue
    if (line && isLikelyPositionTitle(line)) return i
  }
  return -1
}

function findDateIndex(lines: string[], fromIndex: number): number {
  for (let i = fromIndex; i <= fromIndex + 2 && i < lines.length; i++) {
    const line = lines[i]
    if (line && isDateLine(line)) return i
  }
  return -1
}

function findNextSegmentStart(lines: string[], fromIndex: number): number {
  for (let i = fromIndex; i < lines.length; i++) {
    const line = lines[i]
    if (!line || isDefiniteLocationLine(line) || !isLikelyPositionTitle(line)) continue

    const employmentCandidate = lines[i + 1]
    const offset = employmentCandidate && isEmploymentType(employmentCandidate) ? 2 : 1
    if (findDateIndex(lines, i + offset) >= 0) return i
  }

  return lines.length
}

function isLikelyPositionTitle(line: string): boolean {
  if (isDateLine(line)) return false
  if (isEmploymentType(line)) return false
  if (isDurationOnly(line)) return false
  if (isWorkplaceMode(line)) return false
  return true
}

function isDefiniteLocationLine(line: string): boolean {
  const normalized = line.trim().toLowerCase()
  if (!isLocationLike(line)) return false
  return normalized.includes(',') || normalized.endsWith(' area')
}

function isDurationOnly(text: string): boolean {
  return /^\d+\s+yrs?(?:\s+\d+\s+mos?)?$/.test(text.trim())
}

function isEmploymentType(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return (
    normalized === 'full-time' ||
    normalized === 'part-time' ||
    normalized === 'self-employed' ||
    normalized === 'freelance' ||
    normalized === 'contract' ||
    normalized === 'internship' ||
    normalized === 'apprenticeship' ||
    normalized === 'seasonal'
  )
}

function isWorkplaceMode(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return normalized === 'on-site' || normalized === 'remote' || normalized === 'hybrid'
}
