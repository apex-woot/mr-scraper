import type { Locator, Page } from 'playwright'
import {
  ContactPageExtractor,
  type RawSection,
} from '../../extraction/page-extractors'
import type { Contact } from '../../models'
import { log } from '../../utils/logger'
import { mapContactHeadingToType } from './utils'

interface RawAnchor {
  href: string | null
  text: string | null
}

export async function getContactInfo(
  page: Page,
  baseUrl: string,
): Promise<Contact[]> {
  try {
    const extractor = new ContactPageExtractor()
    const result = await extractor.extract({
      baseUrl,
      page,
    })

    if (result.kind !== 'raw') {
      return []
    }

    return extractContactsFromRawSections(result.data)
  } catch (e) {
    log.warning(`Error getting contacts: ${e}`)
    return []
  }
}

export async function extractContactsFromDialog(
  dialog: Locator,
): Promise<Contact[]> {
  const extractor = new ContactPageExtractor()
  const rawSections = await extractor.extractRawSections(dialog)
  return extractContactsFromRawSections(rawSections)
}

function extractContactsFromRawSections(rawSections: RawSection[]): Contact[] {
  const contacts: Contact[] = []

  for (const section of rawSections) {
    const contactType = mapContactHeadingToType(section.heading)
    if (!contactType) {
      continue
    }

    const label = section.labels[0]

    if (
      contactType === 'birthday' ||
      contactType === 'phone' ||
      contactType === 'address'
    ) {
      const value = extractPlainValue(section.text, section.heading)
      if (value) {
        contacts.push({ type: contactType, value })
      }
      continue
    }

    for (const anchor of section.anchors) {
      const normalized = normalizeAnchor(anchor)
      if (!normalized) {
        continue
      }

      if (contactType === 'email') {
        const value = normalized.href?.startsWith('mailto:')
          ? normalized.href.replace('mailto:', '')
          : normalized.text

        if (value) {
          contacts.push({
            type: 'email',
            value,
            label: label || undefined,
          })
        }
        continue
      }

      if (contactType === 'linkedin') {
        if (normalized.href) {
          contacts.push({
            type: 'linkedin',
            value: normalized.href,
            label: label || undefined,
          })
        }
        continue
      }

      const value = normalized.href || normalized.text
      if (value) {
        contacts.push({
          type: contactType,
          value,
          label: label || undefined,
        })
      }
    }
  }

  return dedupeContacts(contacts)
}

function normalizeAnchor(anchor: RawAnchor): RawAnchor | null {
  const href = normalizeValue(anchor.href)
  const text = normalizeValue(anchor.text)

  if (!href && !text) {
    return null
  }

  return { href, text }
}

function extractPlainValue(text: string, heading: string): string | null {
  let cleaned = normalizeValue(text)
  if (!cleaned) {
    return null
  }

  const headingRegex = new RegExp(`^${escapeRegex(heading)}\\s*`, 'i')
  cleaned = cleaned.replace(headingRegex, '').trim()
  cleaned = cleaned.replace(/^:\s*/, '').trim()

  return cleaned || null
}

function dedupeContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>()
  const deduped: Contact[] = []

  for (const contact of contacts) {
    const key = `${contact.type}|${contact.value}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(contact)
  }

  return deduped
}

function normalizeValue(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || null
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
