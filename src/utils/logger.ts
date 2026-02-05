/**
 * Standardized Logging Utilities
 *
 * Provides consistent logging interface with standard Unicode symbols.
 * Centralizes console output formatting across all scrapers.
 */

export const log = {
  /**
   * General debug information
   */
  debug: (message: string): void => {
    console.debug(message)
  },

  /**
   * Successful operation (✓)
   */
  success: (message: string): void => {
    console.debug(`✓ ${message}`)
  },

  /**
   * Warning message (⚠)
   */
  warning: (message: string): void => {
    console.warn(`⚠ ${message}`)
  },

  /**
   * Error message (✗)
   */
  error: (message: string): void => {
    console.debug(`✗ ${message}`)
  },

  /**
   * Skipped operation (⊳)
   */
  skip: (message: string): void => {
    console.debug(`⊳ ${message}`)
  },
}
