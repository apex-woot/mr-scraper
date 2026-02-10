/**
 * LinkedIn Scraping Constants
 *
 * Centralized configuration for magic numbers, thresholds, and patterns used across scrapers.
 * When LinkedIn's behavior changes or scraping needs adjustment, update values here.
 */

export const SCRAPING_CONSTANTS = {
  // Text length thresholds for field detection
  MAX_UNIQUE_TEXT_LENGTH: 200,
  MIN_DESCRIPTION_WORD_COUNT: 6,
  MIN_DESCRIPTION_LENGTH: 100,
  MAX_LOCATION_LENGTH: 100,
  MAX_LOCATION_WORD_COUNT: 6,

  // Scrolling behavior (pause in seconds, max scroll attempts)
  EXPERIENCE_SCROLL_PAUSE: 0.5,
  EXPERIENCE_MAX_SCROLLS: 5,
  EDUCATION_SCROLL_PAUSE: 0.5,
  EDUCATION_MAX_SCROLLS: 5,
  PATENTS_SCROLL_PAUSE: 2.0,
  PATENTS_MAX_SCROLLS: 10,
  ACCOMPLISHMENTS_SCROLL_PAUSE: 1.5,
  ACCOMPLISHMENTS_MAX_SCROLLS: 30,

  // Wait times (seconds) before focusing on sections
  EXPERIENCE_FOCUS_WAIT: 1.5,
  EDUCATION_FOCUS_WAIT: 2,
  PATENTS_FOCUS_WAIT: 2.0,
  ACCOMPLISHMENTS_FOCUS_WAIT: 2.0,
} as const

/**
 * Date parsing patterns and keywords
 */
export const DATE_PATTERNS = {
  // Keywords indicating current/ongoing employment (normalized to "Present")
  CURRENT_KEYWORDS: ['Present', 'Current', 'Now', 'Ongoing'] as const,

  // Separators in date strings
  DURATION_SEPARATOR: '·',
  DATE_RANGE_SEPARATOR: ' - ',

  // Regex patterns for date components
  DURATION_REGEX: /\d+\s+(yr|yrs|mo|mos)/,
  YEAR_REGEX: /\d{4}/,
  DATE_LINE_REGEX: /\d{4}|\d+\s+(yr|yrs|mo|mos)/,
} as const

/**
 * Common CSS selectors used across multiple scrapers
 */
export const COMMON_SELECTORS = {
  // LinkedIn's entity collection items (experiences, education, etc.)
  ENTITY_COLLECTION_ITEM: '[componentkey^="entity-collection-item"]',

  // Expandable text boxes for descriptions
  EXPANDABLE_TEXT: '[data-testid="expandable-text-box"]',

  // Legacy list containers (fallback for older HTML structure)
  LEGACY_LIST_CONTAINER: '.pvs-list__container',
  LEGACY_LIST_ITEM: '.pvs-list__paged-list-item',

  // Top-card action menu for profile-level actions
  PROFILE_TOP_CARD_ROOT: 'section.artdeco-card[data-member-id], main section.artdeco-card, .pv-top-card',
  PROFILE_MORE_ACTIONS_TRIGGER:
    'button[id$="-profile-overflow-action"], button[aria-label="More actions"], button[aria-label="More actions menu"], button[aria-label*="More actions"], .artdeco-dropdown__trigger[aria-label*="More actions"], .artdeco-dropdown__trigger[aria-label*="More"]',
  PROFILE_SAVE_TO_PDF_ACTION:
    'div.artdeco-dropdown__item[role="button"][aria-label="Save to PDF"], [role="menuitem"][aria-label="Save to PDF"], [role="menuitem"]:has-text("Save to PDF"), [role="button"][aria-label="Save to PDF"], button:has-text("Save to PDF"), [aria-label="Save to PDF"]',
} as const
