import { COMMON_SELECTORS } from '../../config/constants'

export const PERSON_PAGE_SELECTOR_SETS = {
  ABOUT_ROOT: [
    '[data-testid="expandable-text-box"]',
    '[data-view-name="profile-card-about"]',
    '[data-view-name="profile-card"]',
  ],
  TOP_CARD_ROOT: [
    'main section.artdeco-card[data-member-id]:has(h1)',
    'section.artdeco-card[data-member-id]:has(h1)',
    '.pv-top-card:has(h1)',
    '[data-view-name*="top-card" i]:has(h1)',
    'main section.artdeco-card:has(h1)',
    COMMON_SELECTORS.PROFILE_TOP_CARD_ROOT,
    'main section:has(h1)',
  ],
} as const
