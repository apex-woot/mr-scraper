import fs from 'node:fs/promises'

export interface ProgressCallback {
  onStart(type: string, url: string): Promise<void> | void
  onProgress(message: string, percent: number): Promise<void> | void
  onComplete(type: string, data: any): Promise<void> | void
  onInfo(message: string): Promise<void> | void
  onWarning(message: string): Promise<void> | void
  onError(message: string, error?: Error): Promise<void> | void
}

export class SilentCallback implements ProgressCallback {
  onStart(_type: string, _url: string): void {}
  onProgress(_message: string, _percent: number): void {}
  onComplete(_type: string, _data: any): void {}
  onInfo(_message: string): void {}
  onWarning(_message: string): void {}
  onError(_message: string, _error?: Error): void {}
}

export class ConsoleCallback implements ProgressCallback {
  private verbose: boolean

  constructor(verbose: boolean = true) {
    this.verbose = verbose
  }

  onStart(type: string, url: string): void {
    console.info(`🚀 Starting ${type} scraping: ${url}`)
  }

  onProgress(message: string, percent: number): void {
    if (this.verbose || percent % 20 === 0) {
      const barLength = 30
      const filled = Math.floor((barLength * percent) / 100)
      const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled)
      console.log(`[${bar}] ${percent}% - ${message}`)
    }
  }

  onComplete(type: string, _data: any): void {
    console.info(`✅ Completed ${type} scraping successfully!`)
  }

  onInfo(message: string): void {
    console.info(`[Info] ${message}`)
  }

  onWarning(message: string): void {
    console.warn(`[Warning] ${message}`)
  }

  onError(message: string, error?: Error): void {
    console.error(`❌ Error: ${message}`, error?.message ?? '')
  }
}

export class JSONLogCallback implements ProgressCallback {
  private logFile: string

  constructor(logFile: string) {
    this.logFile = logFile
  }

  private async log(eventType: string, data: any): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      ...data,
    }

    try {
      await fs.appendFile(this.logFile, `${JSON.stringify(entry)}\n`)
    } catch (e) {
      console.error(`Failed to write to log file: ${e}`)
    }
  }

  async onStart(type: string, url: string): Promise<void> {
    await this.log('start', { scraper_type: type, url })
  }

  async onProgress(message: string, percent: number): Promise<void> {
    await this.log('progress', { message, percent })
  }

  async onComplete(type: string, _data: any): Promise<void> {
    await this.log('complete', { scraper_type: type })
  }

  async onInfo(message: string): Promise<void> {
    await this.log('info', { message })
  }

  async onWarning(message: string): Promise<void> {
    await this.log('warning', { message })
  }

  async onError(message: string, error?: Error): Promise<void> {
    await this.log('error', {
      error: message,
      error_type: error?.name ?? 'Error',
      details: error?.message,
    })
  }
}

export class MultiCallback implements ProgressCallback {
  private callbacks: ProgressCallback[]

  constructor(...callbacks: ProgressCallback[]) {
    this.callbacks = callbacks
  }

  async onStart(type: string, url: string): Promise<void> {
    await Promise.all(this.callbacks.map((c) => c.onStart(type, url)))
  }

  async onProgress(message: string, percent: number): Promise<void> {
    await Promise.all(this.callbacks.map((c) => c.onProgress(message, percent)))
  }

  async onComplete(type: string, data: any): Promise<void> {
    await Promise.all(this.callbacks.map((c) => c.onComplete(type, data)))
  }

  async onInfo(message: string): Promise<void> {
    await Promise.all(this.callbacks.map((c) => c.onInfo(message)))
  }

  async onWarning(message: string): Promise<void> {
    await Promise.all(this.callbacks.map((c) => c.onWarning(message)))
  }

  async onError(message: string, error?: Error): Promise<void> {
    await Promise.all(this.callbacks.map((c) => c.onError(message, error)))
  }
}
