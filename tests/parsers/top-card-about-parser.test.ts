import { describe, expect, test } from 'bun:test'
import { AboutParser, TopCardParser } from '../../src/extraction/parsers'

describe('TopCardParser', () => {
  const parser = new TopCardParser()

  test('parses name/current position/origin and strips contact info suffix', () => {
    const parsed = parser.parse({
      texts: ['Alex Doe', 'Founder', 'Austin, Texas, United States Contact info'],
      links: [],
      context: {},
    })

    expect(parsed).toEqual({
      name: 'Alex Doe',
      headline: 'Founder',
      currentPosition: 'Founder',
      origin: 'Austin, Texas, United States',
    })
    expect(parser.validate(parsed!)).toBe(true)
  })

  test('ignores noise and keeps top-card ordering', () => {
    const parsed = parser.parse({
      texts: [
        'Jordan Vale',
        '500+ connections',
        'Product Research Lead',
        'Riverton, Colorado, United States',
        'Message',
      ],
      links: [],
      context: {},
    })

    expect(parsed).toEqual({
      name: 'Jordan Vale',
      headline: 'Product Research Lead',
      currentPosition: 'Product Research Lead',
      origin: 'Riverton, Colorado, United States',
    })
  })

  test('supports parenthesized names and ignores action menu labels', () => {
    const parsed = parser.parse({
      texts: [
        'Send profile in a message',
        'Save to PDF',
        'Stacy (Weinstein) Ehrlich',
        'Partner',
        'Washington, District of Columbia, United States',
      ],
      links: [],
      context: {},
    })

    expect(parsed).toEqual({
      name: 'Stacy (Weinstein) Ehrlich',
      headline: 'Partner',
      currentPosition: 'Partner',
      origin: 'Washington, District of Columbia, United States',
    })
  })
})

describe('AboutParser', () => {
  const parser = new AboutParser()

  test('filters heading and joins remaining lines', () => {
    const parsed = parser.parse({
      texts: ['About', 'Building resilient data systems.', 'Mentoring teams.'],
      links: [],
      context: {},
    })

    expect(parsed).toBe('Building resilient data systems.\nMentoring teams.')
    expect(parser.validate(parsed!)).toBe(true)
  })

  test('removes see more noise from about text', () => {
    const parsed = parser.parse({
      texts: ['About', 'Designing reliable ETL pipelines... see more', 'See less'],
      links: [],
      context: {},
    })

    expect(parsed).toBe('Designing reliable ETL pipelines')
  })
})
