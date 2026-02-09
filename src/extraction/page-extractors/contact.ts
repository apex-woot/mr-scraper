import type { Locator, Page } from 'playwright'
import { navigateToSection } from './helpers'
import type { PageExtractor, PageExtractorConfig, PageExtractorResult, RawSection } from './types'

const DIALOG_SELECTOR =
  '#artdeco-modal-outlet [data-test-modal][role="dialog"], #artdeco-modal-outlet [role="dialog"], dialog[open], [data-test-modal][role="dialog"], [role="dialog"], .artdeco-modal'
const CONTACT_INFO_TRIGGER_SELECTORS = [
  '#top-card-text-details-contact-info',
  'a[href*="/overlay/contact-info/"]:has-text("Contact info")',
  'a:has-text("Contact info")',
] as const

export class ContactPageExtractor implements PageExtractor {
  readonly sectionName = 'contact'

  async extract(config: PageExtractorConfig): Promise<PageExtractorResult> {
    const dialog =
      (await this.findOpenDialog(config.page)) ||
      (await this.openContactInfoDialogFromTrigger(config)) ||
      (await this.openContactInfoDialogFromOverlayUrl(config))

    if (!dialog) return { kind: 'raw', data: [] }

    const data = await this.extractRawSections(dialog)
    return { kind: 'raw', data }
  }

  private async findOpenDialog(page: Page): Promise<Locator | null> {
    const dialog = page.locator(DIALOG_SELECTOR).first()
    if ((await dialog.count()) === 0) return null

    try {
      if (await dialog.isVisible()) return dialog
    } catch {}

    return null
  }

  private async openContactInfoDialogFromOverlayUrl(config: PageExtractorConfig): Promise<Locator | null> {
    const didNavigate = await navigateToSection(
      config.page,
      config.baseUrl,
      'overlay/contact-info/',
      config.focusWait ?? 1,
    )
    if (!didNavigate) return null

    try {
      await config.page.waitForSelector(DIALOG_SELECTOR, {
        state: 'visible',
        timeout: 7000,
      })
      return config.page.locator(DIALOG_SELECTOR).first()
    } catch {
      return null
    }
  }

  private async openContactInfoDialogFromTrigger(config: PageExtractorConfig): Promise<Locator | null> {
    for (const selector of CONTACT_INFO_TRIGGER_SELECTORS) {
      const trigger = config.page.locator(selector).first()
      if ((await trigger.count()) === 0) continue

      try {
        await trigger.scrollIntoViewIfNeeded()
        await Promise.all([
          config.page.waitForSelector(DIALOG_SELECTOR, {
            state: 'visible',
            timeout: 7000,
          }),
          trigger.click({ timeout: 7000 }),
        ])

        return config.page.locator(DIALOG_SELECTOR).first()
      } catch {}
    }

    return null
  }

  async extractRawSections(dialog: Locator): Promise<RawSection[]> {
    return await dialog.evaluate((root) => {
      const normalize = (input: string | null | undefined): string => {
        if (!input) return ''
        return input.replace(/\s+/g, ' ').trim()
      }

      const contactSections = Array.from(root.querySelectorAll('section.pv-contact-info__contact-type'))
      if (contactSections.length > 0) {
        return contactSections
          .map((sectionNode) => {
            const heading = normalize(sectionNode.querySelector('h3')?.textContent).toLowerCase()
            if (!heading) return null

            const text = normalize(sectionNode.textContent)
            const labels = Array.from(sectionNode.querySelectorAll('span, p, li'))
              .map((el) => normalize(el.textContent))
              .map((t) => {
                const match = t.match(/^\(([^)]+)\)$/)
                return match?.[1]?.trim() ?? null
              })
              .filter((value): value is string => !!value)

            const anchors = Array.from(sectionNode.querySelectorAll('a')).map((anchor) => ({
              href: normalize(anchor.getAttribute('href')) || null,
              text: normalize(anchor.textContent) || null,
            }))

            return {
              heading,
              text,
              labels,
              anchors,
            }
          })
          .filter((item): item is RawSection => item !== null)
      }

      const findContainer = (headingEl: HTMLHeadingElement): Element => {
        const headingText = normalize(headingEl.textContent)
        let current: Element | null = headingEl.parentElement

        while (current && current !== root) {
          const currentText = normalize(current.textContent)
          const headingCount = current.querySelectorAll('h3').length
          const hasAnchor = current.querySelector('a') !== null

          if (headingCount === 1 && (hasAnchor || currentText.length > headingText.length + 2)) {
            return current
          }

          current = current.parentElement
        }

        return headingEl.parentElement ?? headingEl
      }

      const headingNodes = Array.from(root.querySelectorAll('h3'))
      const contactHeadingPattern = /(profile|website|email|phone|twitter|x\.com|birthday|address)/i

      return headingNodes
        .map((headingNode) => {
          const heading = normalize(headingNode.textContent).toLowerCase()
          if (!heading || !contactHeadingPattern.test(heading)) return null

          const container = findContainer(headingNode)
          const text = normalize(container.textContent)
          const labels = Array.from(container.querySelectorAll('span, p, li'))
            .map((el) => normalize(el.textContent))
            .map((t) => {
              const match = t.match(/^\(([^)]+)\)$/)
              return match?.[1]?.trim() ?? null
            })
            .filter((value): value is string => !!value)

          const anchors = Array.from(container.querySelectorAll('a')).map((anchor) => ({
            href: normalize(anchor.getAttribute('href')) || null,
            text: normalize(anchor.textContent) || null,
          }))

          return {
            heading,
            text,
            labels,
            anchors,
          }
        })
        .filter((item): item is RawSection => item !== null)
    })
  }
}
