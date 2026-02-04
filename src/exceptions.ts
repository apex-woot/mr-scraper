function createErrorClass<T extends Record<string, unknown>>(
  name: string,
  extraProps?: (instance: LinkedInScraperError & T) => void,
) {
  return class extends LinkedInScraperError {
    constructor(message: string) {
      super(message)
      this.name = name
      Object.setPrototypeOf(this, new.target.prototype)
      if (extraProps) {
        extraProps(this as LinkedInScraperError & T)
      }
    }
  } as new (
    message: string,
    ...args: unknown[]
  ) => LinkedInScraperError & T
}

export class LinkedInScraperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LinkedInScraperError'
    Object.setPrototypeOf(this, LinkedInScraperError.prototype)
  }
}

export class AuthenticationError extends createErrorClass(
  'AuthenticationError',
) {}
export class ElementNotFoundError extends createErrorClass(
  'ElementNotFoundError',
) {}
export class ProfileNotFoundError extends createErrorClass(
  'ProfileNotFoundError',
) {}
export class NetworkError extends createErrorClass('NetworkError') {}
export class ScrapingError extends createErrorClass('ScrapingError') {}

export class RateLimitError extends LinkedInScraperError {
  constructor(
    message: string,
    public suggestedWaitTime: number = 300,
  ) {
    super(message)
    this.name = 'RateLimitError'
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}
