import { describe, expect, test } from 'bun:test'
import {
  detectExperienceLayout,
  isLikelyCompanyName,
  parseGroupedPositions,
  sanitizeCompanyCandidate,
} from '../../src/extraction/parsers/experience-ir'

describe('experience ir', () => {
  test('detects grouped layout from aggregate duration and multiple date lines', () => {
    const layout = detectExperienceLayout([
      'Example Labs',
      '12 yrs 3 mos',
      'Principal Engineer',
      '2023 - Present · 3 yrs',
      'Senior Engineer',
      '2014 - 2023 · 9 yrs',
    ])

    expect(layout).toBe('grouped')
  })

  test('parses grouped positions from flattened lines', () => {
    const positions = parseGroupedPositions([
      'Example Labs',
      '12 yrs 3 mos',
      'Principal Engineer - Embedded',
      'Full-time',
      '2023 - Present · 3 yrs',
      'Remote',
      'Senior Mechanical Engineer',
      '2014 - 2023 · 9 yrs',
      'Austin, Texas, United States',
    ])

    expect(positions.length).toBe(2)
    expect(positions[0]?.employmentType).toBe('Full-time')
    expect(positions[0]?.fromDate).toBe('2023')
    expect(positions[1]?.fromDate).toBe('2014')
  })

  test('does not treat location lines as titles between grouped roles', () => {
    const positions = parseGroupedPositions([
      'Example Labs',
      '12 yrs 3 mos',
      'Principal Engineer - Embedded',
      '2023 - Present · 3 yrs',
      'Remote',
      'Senior Mechanical Engineer',
      '2014 - 2023 · 9 yrs',
      'Austin, Texas, United States',
      'Mechanical Engineer',
      '2010 - 2014 · 4 yrs',
    ])

    expect(positions.length).toBe(3)
    expect(positions[1]?.title).toBe('Senior Mechanical Engineer')
    expect(positions[2]?.title).toBe('Mechanical Engineer')
    expect(positions[1]?.location).toBe('Austin, Texas, United States')
  })

  test('rejects non-company tokens', () => {
    expect(isLikelyCompanyName('Full-time')).toBe(false)
    expect(isLikelyCompanyName('22 yrs 7 mos')).toBe(false)
    expect(isLikelyCompanyName('2021 - Present · 3 yrs')).toBe(false)
    expect(sanitizeCompanyCandidate('Example Labs')).toBe('Example Labs')
  })
})
