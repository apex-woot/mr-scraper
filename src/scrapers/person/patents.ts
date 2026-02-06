import type { Locator, Page } from 'playwright'
import { PatentPageExtractor } from '../../extraction/page-extractors'
import type { Patent } from '../../models/person'
import { log } from '../../utils/logger'
import { normalizePlainTextLines, toPlainText } from './utils'
import { deduplicateItems, parseItems } from './common-patterns'

/**
 * Represents a link candidate for patent URL extraction
 */
interface LinkCandidate {
  href: string
  text: string | null
}

/**
 * Extracts patent URL from an item using functional pipeline approach.
 * Filters links to find patent-specific URLs and decodes LinkedIn redirects.
 */
async function extractPatentUrl(item: Locator): Promise<string | undefined> {
  const links = await item.locator('a').all()

  const candidates: LinkCandidate[] = await Promise.all(
    links.map(async (link) => ({
      href: (await link.getAttribute('href')) ?? '',
      text: await link.textContent(),
    })),
  )

  return candidates
    .filter(isValidLink)
    .filter(isPatentSpecific)
    .map((c) => c.href)
    .map(decodeLinkedInRedirect)
    .at(0) // First match or undefined
}

/**
 * Validates that a link is usable (not anchor or void link)
 */
function isValidLink({ href }: LinkCandidate): boolean {
  return !!href && !href.includes('#') && !href.includes('void(0)')
}

/**
 * Determines if a link is patent-specific based on text or URL content
 */
function isPatentSpecific({ href, text }: LinkCandidate): boolean {
  return text?.toLowerCase().includes('show patent') || href.includes('patent')
}

/**
 * Decodes LinkedIn redirect URLs to extract the actual target URL.
 * Falls back to original URL if decoding fails.
 */
function decodeLinkedInRedirect(url: string): string {
  if (!url.includes('linkedin.com/redir/redirect')) return url

  const match = url.match(/url=([^&]+)/)
  if (!match?.[1]) return url

  try {
    return decodeURIComponent(match[1])
  } catch {
    return url // Decoding failed, keep original
  }
}

export async function getPatents(
  page: Page,
  baseUrl: string,
): Promise<Patent[]> {
  const patents: Patent[] = []

  try {
    const extraction = await new PatentPageExtractor().extract({
      page,
      baseUrl,
    })
    if (extraction.kind !== 'list' || extraction.items.length === 0) {
      return []
    }

    const items = extraction.items.map((item) => item.locator)
    log.info(`Got ${items.length} patent candidates`)

    const parsed = await parseItems(items, parseExtractedPatent, {
      itemType: 'patent item',
    })
    patents.push(...parsed)
  } catch (e) {
    log.warning(`Error getting patents: ${e}`)
  }

  return deduplicateItems(patents, (p) => `${p.title}|${p.number || ''}`)
}

async function parseExtractedPatent(item: Locator): Promise<Patent | null> {
  return (await parsePatentItem(item)) ?? (await parseMainPagePatent(item))
}

async function parseMainPagePatent(item: Locator): Promise<Patent | null> {
  // Logic for main page parsing (simplified)
  // This is often just a title and maybe a subtitle
  try {
    const texts = await item.allInnerTexts()
    const lines = normalizePlainTextLines(texts[0]?.split('\n') ?? [])

    if (lines.length === 0) return null

    const title = lines[0]!
    let issuer: string | undefined
    let number: string | undefined
    let issuedDate: string | undefined
    let description: string | undefined

    const metadataLine = lines.slice(1).find(looksLikePatentMetadataLine)
    if (metadataLine) {
      const parsed = parsePatentSubtitle(metadataLine)
      issuer = parsed.issuer
      number = parsed.number
      issuedDate = parsed.issuedDate
    }

    const descriptionLines = lines.slice(1).filter((line) => line !== metadataLine)
    if (descriptionLines.length > 0) {
      description = descriptionLines.join('\n')
    }

    return {
      title,
      issuer,
      number,
      issuedDate,
      description,
      plainText: toPlainText(lines),
    }
  } catch (_e) {
    return null
  }
}

async function parsePatentItem(item: Locator): Promise<Patent | null> {
  try {
    // Strategy: Look for <p> tags first as they explicitly separate title, subtitle, and description in the HTML
    let texts = await item.locator('p').allInnerTexts()

    // Filter out empty strings
    texts = texts.map((t) => t.trim()).filter((t) => t.length > 0)

    // If no P tags found, fallback to splitting the full text by newlines
    if (texts.length === 0) {
      const fullText = await item.innerText()
      texts = fullText
        .split('\n')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    }

    // Normalize and dedupe repeated hidden/visible text lines.
    const lines = normalizePlainTextLines(texts)

    // Filter out "Patents" header and empty state messages
    if (lines.length === 1 && lines[0] === 'Patents') return null
    if (
      lines.length > 0 &&
      lines.some((t) => t.includes('adds will appear here'))
    )
      return null

    if (lines.length === 0) return null

    const title = lines[0]!
    let issuer: string | undefined
    let number: string | undefined
    let issuedDate: string | undefined
    let description: string | undefined

    const metadataLine = lines.slice(1).find(looksLikePatentMetadataLine)
    if (metadataLine) {
      const parsed = parsePatentSubtitle(metadataLine)
      issuer = parsed.issuer
      number = parsed.number
      issuedDate = parsed.issuedDate
    }

    const descriptionLines = lines
      .slice(1)
      .filter((line) => line !== metadataLine && !looksLikePatentMetadataLine(line))
    if (descriptionLines.length > 0) {
      description = descriptionLines.join('\n')
    }

    // Extract patent URL using functional pipeline
    const url = await extractPatentUrl(item)

    return {
      title,
      issuer,
      number,
      issuedDate,
      url,
      description,
      plainText: toPlainText(lines),
    }
  } catch (e) {
    log.debug(`Error parsing patent item: ${e}`)
    return null
  }
}

function looksLikePatentMetadataLine(line: string): boolean {
  const normalized = line.trim()
  if (!normalized) return false

  if (/\bissued\b/i.test(normalized)) return true

  // Examples: "US US10424882B2", "US 9,349,265"
  const idLike = /^[A-Z]{2}\s+[A-Z0-9,\-]+(?:\s+[A-Z0-9,\-]+)*$/.test(normalized)
  return idLike && /\d/.test(normalized)
}

function parsePatentSubtitle(subtitle: string): {
  issuer?: string
  number?: string
  issuedDate?: string
} {
  // Expected format: "US US10424882B2 · Issued Sep 24, 2019"
  // Or just "US 9,349,265"
  // Or "Issued Nov 11, 2014"

  let issuer: string | undefined
  let number: string | undefined
  let issuedDate: string | undefined

  try {
    const parts = subtitle.split('·').map((s) => s.trim())

    // Part 1: "US US10424882B2" or "US 9,349,265"
    const idPart = parts[0]
    if (idPart) {
      if (idPart.toLowerCase().startsWith('issued')) {
        issuedDate = idPart.replace(/issued/i, '').trim() || issuedDate
      } else {
      // Check if it starts with a country code (2 uppercase letters usually)
        const match = idPart.match(/^([A-Z]{2})\s+(.+)$/)
        if (match) {
          issuer = match[1]
          number = match[2]
        } else {
          // fallback
          number = idPart
        }
      }
    }

    // Part 2: "Issued Sep 24, 2019"
    if (parts.length > 1) {
      const datePart = parts[1]!
      if (datePart.toLowerCase().startsWith('issued')) {
        issuedDate = datePart.replace(/issued/i, '').trim()
      } else {
        // just assume it's the date
        issuedDate = datePart
      }
    }
  } catch (_e) {
    // ignore parsing errors
  }

  return { issuer, number, issuedDate }
}
