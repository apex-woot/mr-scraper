import { describe, expect, test } from 'bun:test'
import type { RawSection } from '../../src/extraction/page-extractors'
import { ContactParser } from '../../src/extraction/parsers'

describe('ContactParser', () => {
  const parser = new ContactParser()

  test('parses raw sections and deduplicates contacts', () => {
    const sections: RawSection[] = [
      {
        heading: 'Email',
        text: 'Email',
        labels: [],
        anchors: [
          { href: 'mailto:test@example.com', text: 'test@example.com' },
          { href: 'mailto:test@example.com', text: 'test@example.com' },
        ],
      },
      {
        heading: 'Profile',
        text: 'Profile',
        labels: [],
        anchors: [{ href: 'https://www.linkedin.com/in/sample', text: 'Profile' }],
      },
      {
        heading: 'Phone',
        text: 'Phone: +1 (555) 123-4567',
        labels: [],
        anchors: [],
      },
    ]

    const parsed = parser.parseRaw(sections)
    expect(parsed).toEqual([
      { type: 'email', value: 'test@example.com' },
      { type: 'linkedin', value: 'https://www.linkedin.com/in/sample' },
      { type: 'phone', value: '+1 (555) 123-4567' },
    ])
  })

  test('parses overlay-style profile and website contacts', () => {
    const sections: RawSection[] = [
      {
        heading: "russ' profile",
        text: 'Russ profile linkedin.com/in/sample-user',
        labels: [],
        anchors: [{ href: 'https://www.linkedin.com/in/sample-user', text: 'linkedin.com/in/sample-user' }],
      },
      {
        heading: 'website',
        text: 'Website example.test (Company)',
        labels: ['Company'],
        anchors: [{ href: 'https://example.test', text: 'example.test' }],
      },
      {
        heading: 'get up to 4.6x replies when you message with inmail',
        text: 'upsell content',
        labels: [],
        anchors: [],
      },
    ]

    const parsed = parser.parseRaw(sections)
    expect(parsed).toEqual([
      { type: 'linkedin', value: 'https://www.linkedin.com/in/sample-user' },
      { type: 'website', value: 'https://example.test', label: 'Company' },
    ])
  })
})
